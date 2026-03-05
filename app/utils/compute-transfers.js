/**
 * Computes inventory transfers by diffing original vs current quantities,
 * then FCFS-matching origins (decreased) to destinations (increased) per variant.
 *
 * Returns a flat array of "Atomic Transfer Actions".
 *
 * Shape:
 * [
 *   {
 *     variantId: "gid://...",
 *     inventoryItemId: "gid://...",
 *     productTitle: "Product Name",
 *     color: "Blue",
 *     size: "10",
 *     quantity: 2,
 *     origin: { id: "gid://...", name: "Warehouse" },
 *     destination: { id: "gid://...", name: "Store A" }
 *   },
 *   ...
 * ]
 */
export const computeTransfers = (originalQuantities, quantities, locations, products) => {
    const actions = [];

    // Build a lookup: variantId -> Metadata (product name, color, size, inventoryItemId)
    const variantMetadataMap = {};
    for (const product of products) {
        for (const colorGroup of product.colorGroups) {
            for (const size of colorGroup.sizes) {
                variantMetadataMap[size.variantId] = {
                    inventoryItemId: size.inventoryItemId,
                    productTitle: product.title,
                    color: colorGroup.color,
                    size: size.size
                };
            }
        }
    }

    // Process each variant independently
    const variantIds = Object.keys(originalQuantities);

    for (const variantId of variantIds) {
        const originalByLoc = originalQuantities[variantId] || {};
        const currentByLoc = quantities[variantId] || {};
        const meta = variantMetadataMap[variantId];

        if (!meta) continue;

        // Compute diffs and separate into origins and destinations (in location order for FCFS)
        const origins = [];      // locations that lost stock (diff < 0)
        const destinations = []; // locations that gained stock (diff > 0)

        for (let locIndex = 0; locIndex < locations.length; locIndex++) {
            const original = originalByLoc[locIndex] ?? 0;
            const current = currentByLoc[locIndex] ?? 0;
            const diff = current - original;

            if (diff < 0) {
                origins.push({
                    locIndex,
                    remaining: Math.abs(diff),
                    location: locations[locIndex]
                });
            } else if (diff > 0) {
                destinations.push({
                    locIndex,
                    remaining: diff,
                    location: locations[locIndex]
                });
            }
        }

        // FCFS matching: walk origins and destinations in order, greedily pair them
        let originIdx = 0;
        let destIdx = 0;

        while (originIdx < origins.length && destIdx < destinations.length) {
            const originItem = origins[originIdx];
            const destItem = destinations[destIdx];

            const transferQty = Math.min(originItem.remaining, destItem.remaining);

            if (transferQty > 0) {
                actions.push({
                    variantId,
                    inventoryItemId: meta.inventoryItemId,
                    productTitle: meta.productTitle,
                    color: meta.color,
                    size: meta.size,
                    quantity: transferQty,
                    origin: {
                        id: originItem.location.id,
                        name: originItem.location.name
                    },
                    destination: {
                        id: destItem.location.id,
                        name: destItem.location.name
                    }
                });

                originItem.remaining -= transferQty;
                destItem.remaining -= transferQty;
            }

            if (originItem.remaining === 0) originIdx++;
            if (destItem.remaining === 0) destIdx++;
        }
    }

    return actions;
};

/**
 * Groups atomic transfer actions by (origin, destination) pair for mutation.
 * Returns the format expected by inventoryTransferCreate.
 */
export const groupTransfersForMutation = (actions) => {
    const grouped = {};

    for (const action of actions) {
        const key = `${action.origin.id}->${action.destination.id}`;

        if (!grouped[key]) {
            grouped[key] = {
                originLocationId: action.origin.id,
                destinationLocationId: action.destination.id,
                lineItems: []
            };
        }

        // Check if this inventoryItemId already exists in this group and combine if so
        const existingLineItem = grouped[key].lineItems.find(
            li => li.inventoryItemId === action.inventoryItemId
        );

        if (existingLineItem) {
            existingLineItem.quantity += action.quantity;
        } else {
            grouped[key].lineItems.push({
                inventoryItemId: action.inventoryItemId,
                quantity: action.quantity
            });
        }
    }

    return Object.values(grouped);
};