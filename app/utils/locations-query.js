export const buildLocationsQuery = () => {
    return `#graphql
    query {
        locations(first: 50) {
            nodes {
                id
                name
            }
        }
    }
    `;
}