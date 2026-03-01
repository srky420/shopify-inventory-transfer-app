
export const groupVariantsByProduct = (variants, locations) => {
    const groupedVariants = variants.reduce((acc, variant) => {
        const productId = variant.product.id;
        if (!acc[productId]) {
            acc[productId] = [];
        }
        acc[productId].push(variant);
        return acc;
    }, {});

    const productsArray = Object.entries(groupedVariants).map(([id, variants]) => ({
        id,
        title: variants[0].product.title,
        variants,
        colorGroups: groupVariantsByColor(variants, locations),
    }));

    return productsArray;
};

const getOptionValue = (variant, optionName) => {
    const option = variant.selectedOptions?.find(
        (o) => o.name.toLowerCase() === optionName.toLowerCase()
    );
    return option?.value || null;
};

// Reads the aliased location fields (location_0, location_1, ...) from
// a variant's inventoryItem and returns an array of available quantities
// in the same order as the locations array. Null aliases (item not stocked
// at that location) become 0.
const extractInventoryForLocations = (variant, locations) => {
    return locations.map((_, index) => {
        const level = variant.inventoryItem[`location_${index}`];
        if (!level) return 0;
        return level.quantities?.find((q) => q.name === "available")?.quantity ?? 0;
    });
};

const groupVariantsByColor = (variants, locations) => {
    const colorMap = variants.reduce((acc, variant) => {
        const color = getOptionValue(variant, "color") || "Default";
        if (!acc[color]) {
            acc[color] = [];
        }

        acc[color].push({
            size: getOptionValue(variant, "size") || variant.title,
            variantId: variant.id,
            sku: variant.sku,
            // An array of available quantities, one per location.
            // inventory[i] corresponds to locations[i].
            inventory: extractInventoryForLocations(variant, locations),
        });

        return acc;
    }, {});

    return Object.entries(colorMap).map(([color, sizes]) => {
        // Sort sizes numerically so "10" comes after "9", not after "1"
        sizes.sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

        return { color, sizes };
    });
};