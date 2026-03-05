/**
 * Builds a batched GraphQL query to get the orders count for multiple locations
 * filtered by a set of SKUs and a date range.
 * 
 * @param {string[]} skus - Array of SKUs to filter by
 * @param {Array} locations - Array of Shopify location objects 
 * @param {number} days - Number of days to look back for sales (default 30)
 * @returns {string} - The GraphQL query string
 */
export const buildBatchedOrdersCountQuery = (skus, locations, days = 30) => {
    // Generate the date string for the query (created_at filter)
    const date = new Date();
    date.setDate(date.getDate() - days);
    const formattedDate = date.toISOString().split('T')[0];

    // Build the SKU filter part of the query
    // Example: (sku:SKU1 OR sku:SKU2 OR ...)
    const skuQuery = skus.filter(Boolean).map(sku => `sku:${sku}`).join(' OR ');

    // Map each location to an aliased ordersCount query
    const queryParts = locations.map((loc, index) => {
        const locationId = loc.id;
        const query = `location_id:${locationId} AND (${skuQuery}) AND created_at:>=${formattedDate} AND fulfillment_status:fulfilled`;

        return `loc_${index}: ordersCount(query: "${query}") { count }`;
    });

    return `#graphql
    query {
        ${queryParts.join('\n        ')}
    }`;
};
