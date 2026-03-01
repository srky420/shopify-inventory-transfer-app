import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";
import { batchArray, buildBatchedQuery } from "../utils/variants-batch-query";
import { groupVariantsByProduct } from "../utils/variants-grouping";
import { buildLocationsQuery } from "../utils/locations-query";

export const loader = async ({ request}) => {
    const { admin } = await authenticate.admin(request);

    const url = new URL(request.url);
    const variantParams = url.searchParams.get("variants_ids");
    const variantIds = variantParams ? variantParams.split(",") : [];
    
    if (variantIds.length === 0) {
        return { variants: [], locations: [] };
    }

    const locationsQuery = buildLocationsQuery();
    const locationsResponse = await admin.graphql(locationsQuery);
    const locationsResult = await locationsResponse.json();
    const locations = locationsResult.data.locations.nodes;

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

    const totalActualCost = batchResults.reduce((sum, result) => {
        return sum + (result.extensions?.cost?.actualQueryCost || 0);
    }, 0);
    
    console.log(`Total Query Cost: ${totalActualCost} points | Batches: ${batches.length} | Total Variants: ${variantIds.length}`);

    const variants = batchResults.flatMap((result) => {
        return Object.values(result.data).filter(Boolean);
    });

    return { variants, locations };
}

export default function Transfer() {
    const [products, setProducts] = useState([]);
    const [quantities, setQuantities] = useState({});
    
    const { variants, locations } = useLoaderData();

    useEffect(() => {
        const productsArray = groupVariantsByProduct(variants, locations);
        setProducts(productsArray);

        const initialQuantities = {};
        productsArray.forEach((product) => {
            product.colorGroups.forEach((colorGroup) => {
                colorGroup.sizes.forEach((size) => {
                    initialQuantities[size.variantId] = {};
                    size.inventory.forEach((qty, locIndex) => {
                        initialQuantities[size.variantId][locIndex] = qty;
                    });
                });
            });
        });
        setQuantities(initialQuantities);
    }, [variants, locations]);

    const handleQuantityChange = (variantId, locIndex, value) => {
        const parsed = parseInt(value, 10);
        setQuantities((prev) => ({
            ...prev,
            [variantId]: {
                ...prev[variantId],
                [locIndex]: isNaN(parsed) ? 0 : parsed,
            },
        }));
    };

    const getQuantity = (variantId, locIndex) => {
        return quantities[variantId]?.[locIndex] ?? 0;
    };

    const getLocationTotal = (sizes, locIndex) => {
        return sizes.reduce((sum, size) => sum + getQuantity(size.variantId, locIndex), 0);
    };

    const getSizeTotal = (variantId) => {
        if (!quantities[variantId]) return 0;
        return Object.values(quantities[variantId]).reduce((sum, qty) => sum + qty, 0);
    };

    const getGrandTotal = (sizes) => {
        return sizes.reduce((sum, size) => sum + getSizeTotal(size.variantId), 0);
    };

    if (products.length === 0) {
        return (
            <s-page heading="Inventory Transfer">
                <s-section>
                    <s-paragraph>No products to display.</s-paragraph>
                </s-section>
            </s-page>
        );
    }

    return (
        <s-page heading="Inventory Transfer" inlineSize="large">
            {products.map((product) => (
                <s-section key={product.id} inlineSize="large">
                    <s-heading>{product.title}</s-heading>

                    {product.colorGroups.map((colorGroup) => (
                        <s-box key={colorGroup.color} paddingBlockStart="base">
                            <s-text fontWeight="bold" tone="accent">
                                Color: {colorGroup.color}
                            </s-text>

                            <s-box paddingBlockStart="tight">
                                <s-section padding="none">
                                    <s-table>
                                        <s-table-header-row>
                                            <s-table-header>Location</s-table-header>
                                            <s-table-header format="numeric">Total</s-table-header>
                                            {colorGroup.sizes.map((size) => (
                                                <s-table-header
                                                    key={size.variantId}
                                                    format="numeric"
                                                >
                                                    {size.size}
                                                </s-table-header>
                                            ))}
                                        </s-table-header-row>
                                        <s-table-body>
                                            {locations.map((location, locIndex) => (
                                                <s-table-row key={location.id}>
                                                    <s-table-cell>{location.name}</s-table-cell>
                                                    <s-table-cell>
                                                        {getLocationTotal(colorGroup.sizes, locIndex)}
                                                    </s-table-cell>
                                                    {colorGroup.sizes.map((size) => (
                                                        <s-table-cell key={size.variantId}>
                                                            <s-number-field
                                                                label={`${size.size} at ${location.name}`}
                                                                labelAccessibilityVisibility="exclusive"
                                                                value={String(getQuantity(size.variantId, locIndex))}
                                                                step={1}
                                                                inputMode="numeric"
                                                                onChange={(e) =>
                                                                    handleQuantityChange(
                                                                        size.variantId,
                                                                        locIndex,
                                                                        e.currentTarget.value
                                                                    )
                                                                }
                                                            />
                                                        </s-table-cell>
                                                    ))}
                                                </s-table-row>
                                            ))}
                                            <s-table-row>
                                                <s-table-cell>
                                                    <s-text fontWeight="bold">Totals</s-text>
                                                </s-table-cell>
                                                <s-table-cell>
                                                    <s-text fontWeight="bold">
                                                        {getGrandTotal(colorGroup.sizes)}
                                                    </s-text>
                                                </s-table-cell>
                                                {colorGroup.sizes.map((size) => (
                                                    <s-table-cell key={size.variantId}>
                                                        <s-text fontWeight="bold">
                                                            {getSizeTotal(size.variantId)}
                                                        </s-text>
                                                    </s-table-cell>
                                                ))}
                                            </s-table-row>
                                        </s-table-body>
                                    </s-table>
                                </s-section>
                            </s-box>
                        </s-box>
                    ))}
                </s-section>
            ))}
        </s-page>
    );
}
