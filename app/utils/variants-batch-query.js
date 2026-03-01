// Helper function to batch arrays
export const batchArray = (array, batchSize) => {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
        batches.push(array.slice(i, i + batchSize));
    }
    return batches;
};

// Helper function to build batched query using GraphQL aliases
export const buildBatchedQuery = (variantIds, locations) => {
    const queryParts = variantIds.map((id, index) => {
        return `variant_${index}: productVariant(id: "${id.trim()}") {
            id
            title
            product {
                id
                title
            }
            selectedOptions {
                name
                value
            }
            sku
            inventoryItem {
                id
                ${locations.map((loc, index) => (
                    `location_${index}: inventoryLevel(locationId: "${loc.id}") {
                        id
                        location {
                            id
                            name
                        }
                        quantities(names: ["available"]) {
                            name
                            quantity
                        }
                    }`
                ))}
            }
        }`;
    });

    return `#graphql
    query {
        ${queryParts.join('\n')}
    }`;
};