import { batchArray, buildBatchedQuery } from "../utils/variants-batch-query";
import { buildLocationsQuery } from "../utils/locations-query";
import { groupVariantsByProduct } from "../utils/variants-grouping";
import { buildBatchedOrdersCountQuery } from "../utils/orders-count-query";

export async function getInventoryTransferData(admin, variantIds) {
    // Handle no IDs case
    if (variantIds.length === 0) {
        return { variants: [], locations: [] };
    }

    // Build locations query and sort locations data for "900 Web / WH"
    const locationsQuery = buildLocationsQuery();
    const locationsResponse = await admin.graphql(locationsQuery);
    const locationsResult = await locationsResponse.json();
    const locations = locationsResult.data.locations.nodes.sort((a, b) => {
        if (a.name === "900 Web / WH") return -1;
        if (b.name === "900 Web / WH") return 1;
        return 0;
    });

    // Create batches of 20 variants per query (Using GraphQL aliases)
    const BATCH_SIZE = 20;
    const batches = batchArray(variantIds, BATCH_SIZE);

    const batchResults = await Promise.all(
        batches.map(async (batch) => {
            const query = buildBatchedQuery(batch, locations);
            const response = await admin.graphql(query);
            const result = await response.json();
            return result;
        })
    );

    // Get results of the query and log the total cost of the all the batched queries
    const totalActualCost = batchResults.reduce((sum, result) => {
        return sum + (result.extensions?.cost?.actualQueryCost || 0);
    }, 0);
    console.log(`Total Query Cost: ${totalActualCost} points | Batches: ${batches.length} | Total Variants: ${variantIds.length}`);

    // Flatten the object of data into an array of variants
    const variants = batchResults.flatMap((result) => {
        return Object.values(result.data).filter(Boolean);
    });

    // Group the variants by product and create color groups inside each product item
    const productsArray = groupVariantsByProduct(variants, locations);

    // Fetch ordersCount (sales popularity) per color group
    const salesData = {};
    await Promise.all(productsArray.flatMap(product =>
        product.colorGroups.map(async (colorGroup) => {
            const skus = colorGroup.sizes.map(s => s.sku).filter(Boolean);
            if (skus.length === 0) return;

            const query = buildBatchedOrdersCountQuery(skus, locations);
            const response = await admin.graphql(query);
            const result = await response.json();
            salesData[`${product.id}-${colorGroup.color}`] = result.data;
        })
    ));

    return { locations, productsArray, salesData };
}