// Get the inventory diff between original and current quantities for a specific variant at a specific location
export const InventoryDiff = ({ variantId, locIndex, originalQuantities, quantities }) => {
    const original = originalQuantities[variantId]?.[locIndex] ?? 0;
    const current = quantities[variantId]?.[locIndex] ?? 0;
    const diff = current - original;

    if (diff === 0) return null;

    const isPositive = diff > 0;
    return (
        <div style={{ position: 'absolute', top: "50%", left: "100%", transform: "translateY(-50%)" }}>
            <s-text
                tone={isPositive ? "success" : "critical"}
                variant="bodySmall"
                fontWeight="bold"
            >
                {isPositive ? `+${diff}` : diff}
            </s-text>
        </div>
    );
};