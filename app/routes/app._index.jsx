import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Loader to authenticate the request and perform server-side actions 
// (runs on server-side, so console logs are also shown on the terminal where the server is running)
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Integrate Resource Picker to select products and update selection state
  const handleSelectProducts = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
      filter: {
        variants: true,
        draft: false,
        archived: false,
      },
      selectionIds: selectedProducts.map((p) => ({
        id: p.id,
        variants: p.variants.map((v) => ({ id: v.id })),
      })),
    });

    if (selected) {
      setSelectedProducts(selected);
      console.log(selected);
    }
  }

  // Handle removal of a product from selection state
  const handleRemoveProduct = (productId) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  }

  // Handle redirection to inventory transfer page with selected variant IDs in URL params
  const handleViewInventory = () => {
    const ids = selectedProducts.map((p) => p.variants.map((v) => v.id).join(",")).join(",");
    navigate(`/app/transfer?variants_ids=${encodeURIComponent(ids)}`);
  }

  return (
    <s-page heading="Inventory Transfer">
      <s-button slot="primary-action" onClick={handleSelectProducts}>
        Select Products
      </s-button>

      {selectedProducts.length === 0 ? (
        <s-section>
          <s-empty-state
            heading="No products selected"
            action-label="Select Products"
            onAction={handleSelectProducts}
          >
            <s-paragraph>
              Selected products will be added here, you can then view the inventory of the selected products.
            </s-paragraph>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section heading={`${selectedProducts.length} product(s) selected`}>
          <s-stack direction="block" gap="base">
            {selectedProducts.map((product) => (
              <s-box
                key={product.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="base" wrap={false}>
                  <s-stack direction="block" gap="tight" style={{ flex: 1 }}>
                    <s-text fontWeight="bold">{product.title}</s-text>
                    <s-text tone="subdued">
                      {product.variants.length} variant(s)
                    </s-text>
                  </s-stack>
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => handleRemoveProduct(product.id)}
                  >
                    Remove
                  </s-button>
                </s-stack>
              </s-box>
            ))}
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={handleViewInventory}>
                View Inventory
              </s-button>
              <s-button onClick={handleSelectProducts}>
                Change Selection
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
