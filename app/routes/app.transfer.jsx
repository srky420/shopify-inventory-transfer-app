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
    // Component states
    const [products, setProducts] = useState([]);
    const [quantities, setQuantities] = useState({});
    const [originalTotals, setOriginalTotals] = useState({});
    const [originalQuantities, setOriginalQuantities] = useState({});
    
    const { variants, locations } = useLoaderData();

    useEffect(() => {
        const productsArray = groupVariantsByProduct(variants, locations);
        setProducts(productsArray);

        const initialQuantities = {};
        const totals = {};
        productsArray.forEach((product) => {
            product.colorGroups.forEach((colorGroup) => {
                colorGroup.sizes.forEach((size) => {
                    initialQuantities[size.variantId] = {};
                    size.inventory.forEach((qty, locIndex) => {
                        initialQuantities[size.variantId][locIndex] = qty;
                    });
                    totals[size.variantId] = size.inventory.reduce((sum, qty) => sum + qty, 0);
                });
            });
        });
        setQuantities(initialQuantities);
        setOriginalQuantities(initialQuantities);
        setOriginalTotals(totals);
        console.log(initialQuantities);
        console.log(productsArray);
        console.log(totals);
    }, [variants, locations]);

    // Handle quantity change for a specific variant at a specific location
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

    // Get quantity for a specific variant at a specific location
    const getQuantity = (variantId, locIndex) => {
        return quantities[variantId]?.[locIndex] ?? 0;
    };

    // Horizontal total for a location
    const getLocationTotal = (sizes, locIndex) => {
        return sizes.reduce((sum, size) => sum + getQuantity(size.variantId, locIndex), 0);
    };

    // Total quantities for a size
    const getSizeTotal = (variantId) => {
        if (!quantities[variantId]) return 0;
        return Object.values(quantities[variantId]).reduce((sum, qty) => sum + qty, 0);
    };

    // Grand total for all sizes in a column
    const getGrandTotal = (sizes) => {
        return sizes.reduce((sum, size) => sum + getSizeTotal(size.variantId), 0);
    };

    // Check if quantity is balanced or not
    const isBalanced = (variantId) => {
        return originalTotals[variantId] === getSizeTotal(variantId);
    }

    if (products.length === 0) {
        return (
            <s-page heading="Inventory Transfer" inlineSize="large">
                <s-section>
                    <s-spinner accessibilityLabel="Loading" size="large-100" />
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
                                                            <s-stack direction="inline" gap="tight" alignItems="center" inlineSize="large">
                                                                <s-number-field
                                                                    label={`${size.size} at ${location.name}`}
                                                                    labelAccessibilityVisibility="exclusive"
                                                                    value={getQuantity(size.variantId, locIndex)}
                                                                    step={1}
                                                                    inputMode="numeric"
                                                                    onChange={(e) =>
                                                                        handleQuantityChange(
                                                                            size.variantId,
                                                                            locIndex,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                                <InventoryDiff variantId={size.variantId} locIndex={locIndex} originalQuantities={originalQuantities} quantities={quantities} />
                                                            </s-stack>
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
                                                        <s-text fontWeight="bold" tone={isBalanced(size.variantId) ? "success" : "warning"}>
                                                            {getSizeTotal(size.variantId)} {isBalanced(size.variantId) ? "✓" : "✗"}
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

// Get the inventory diff between original and current quantities for a specific variant at a specific location
const InventoryDiff = ({variantId, locIndex, originalQuantities, quantities}) => {
    const original = originalQuantities[variantId]?.[locIndex] ?? 0;
    const current = quantities[variantId]?.[locIndex] ?? 0;
    const diff = current - original;

    if (diff === 0) return null;

    const isPositive = diff > 0;
    return (
        <s-badge
            tone={isPositive ? "success" : "critical"} 
            variant="bodySmall"
            fontWeight="bold"
        >
            {isPositive ? `+${diff}` : diff}
        </s-badge>
    );
};