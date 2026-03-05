import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { useEffect, useMemo, useState } from "react";
import { computeTransfers } from "../utils/compute-transfers";
import { getInventoryTransferData } from "../services/transfer-route-data.server";
import { InventoryDiff } from "../components/InventoryDiff";
import { SaveTransfers } from "../components/SaveTranfers";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    // Get variant IDs from URL params
    const url = new URL(request.url);
    const variantParams = url.searchParams.get("variants_ids");
    const variantIds = variantParams ? variantParams.split(",") : [];

    return getInventoryTransferData(admin, variantIds);
}

export default function Transfer() {
    // Component states
    const [products, setProducts] = useState([]);
    const [quantities, setQuantities] = useState({});
    const [originalTotals, setOriginalTotals] = useState({});
    const [originalQuantities, setOriginalQuantities] = useState({});

    const { locations, productsArray, salesData } = useLoaderData();

    // Calculate transfers from utils function whenever quantities changed through input
    const transfers = useMemo(
        () => computeTransfers(originalQuantities, quantities, locations, products),
        [originalQuantities, quantities, locations, products]
    );

    console.log('Transfers:', transfers);

    useEffect(() => {

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
        console.log('Quantities:', initialQuantities);
        console.log('Products:', productsArray);
        console.log('Total variants:', totals);
    }, [products, locations]);

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

    // Check if quantity is balanced for all variants
    const isAllBalanced = () => {
        return Object.keys(originalTotals).every((variantId) => isBalanced(variantId));
    }

    // Get the sales count for a specific color and location
    const getSalesCount = (color, locIndex, productId) => {
        return salesData[`${productId}-${color}`]?.[`loc_${locIndex}`]?.count || 0;
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

                    {product.colorGroups.map((colorGroup) => {
                        const colorTransfers = transfers.filter(t => t.color === colorGroup.color);

                        return (
                            <s-box key={colorGroup.color} paddingBlockStart="base" overflow="visible">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
                                    <s-heading level="2">
                                        Color: {colorGroup.color}
                                    </s-heading>

                                    {colorTransfers.length > 0 && (
                                        <s-stack>
                                            {colorTransfers.map((t, i) => (
                                                <s-text key={i} tone="info">
                                                    {t.color}/{t.size}: {t.quantity} Qty from {t.origin.name} to {t.destination.name}
                                                </s-text>
                                            ))}
                                        </s-stack>
                                    )}
                                </div>

                                <s-section padding="base">
                                    <s-table>
                                        <s-table-header-row>
                                            <s-table-header>Location</s-table-header>
                                            <s-table-header format="numeric">Sold</s-table-header>
                                            <s-table-header format="numeric">Total</s-table-header>
                                            {colorGroup.sizes.map((size) => (
                                                <s-table-header
                                                    key={size.variantId}
                                                    format="numeric"
                                                >
                                                    <s-box>{size.size}</s-box>
                                                </s-table-header>
                                            ))}
                                        </s-table-header-row>
                                        <s-table-body>
                                            {locations.map((location, locIndex) => (
                                                <s-table-row key={location.id}>
                                                    <s-table-cell>{location.name}</s-table-cell>
                                                    <s-table-cell>
                                                        <s-text tone="subdued">
                                                            {getSalesCount(colorGroup.color, locIndex, product.id)}
                                                        </s-text>
                                                    </s-table-cell>
                                                    <s-table-cell>
                                                        {getLocationTotal(colorGroup.sizes, locIndex)}
                                                    </s-table-cell>
                                                    {colorGroup.sizes.map((size) => (
                                                        <s-table-cell key={size.variantId}>
                                                            <div style={{ position: 'relative' }}>
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
                                                            </div>
                                                        </s-table-cell>
                                                    ))}
                                                </s-table-row>
                                            ))}
                                            <s-table-row>
                                                <s-table-cell>
                                                    <s-text fontWeight="bold">Totals</s-text>
                                                </s-table-cell>
                                                <s-table-cell></s-table-cell>
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
                        );
                    })}
                </s-section>
            ))}

            <SaveTransfers isAllBalanced={isAllBalanced()} transfers={transfers} />
        </s-page>
    );
}