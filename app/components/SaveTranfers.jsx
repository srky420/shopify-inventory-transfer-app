import { useEffect, useState } from "react";

export const SaveTransfers = ({ isAllBalanced, transfers }) => {

    // Component states
    const [groupedTransfers, setGroupedTransfers] = useState([]);

    useEffect(() => {
        // Grouping tranfers based on variantId
        const transfersObject = {}
        transfers.map((t) => {
            if (transfersObject[t.variantId]) {
                transfersObject[t.variantId].push(t);
            } else {
                transfersObject[t.variantId] = [t];
            }
        })
        const transfersArray = Object.entries(transfersObject).map(([variantId, transfers]) => {
            return {
                variantId,
                transfers
            }
        })
        console.log('Grouped Transfers:', transfersArray);
        setGroupedTransfers(transfersArray);
    }, [transfers])

    return (
        <s-section>
            <s-button commandFor="modal" disabled={!isAllBalanced}>Save Transfers</s-button>

            <s-modal id="modal" heading="Details">
                {groupedTransfers.map((groupedTransfer) => (
                    <s-table key={groupedTransfer.variantId}>
                        <s-table-header-row>
                            <s-table-header>Product</s-table-header>
                            <s-table-header>Origin</s-table-header>
                            <s-table-header>Destination</s-table-header>
                            <s-table-header>Color</s-table-header>
                            <s-table-header>Size</s-table-header>
                            <s-table-header>Quantity</s-table-header>
                        </s-table-header-row>
                        <s-table-body>
                            {groupedTransfer.transfers.map((t, i) => (
                                <s-table-row key={i}>
                                    <s-table-cell>{t.productTitle}</s-table-cell>
                                    <s-table-cell>{t.origin.name}</s-table-cell>
                                    <s-table-cell>{t.destination.name}</s-table-cell>
                                    <s-table-cell>{t.color}</s-table-cell>
                                    <s-table-cell>{t.size}</s-table-cell>
                                    <s-table-cell>{t.quantity}</s-table-cell>
                                </s-table-row>
                            ))}
                        </s-table-body>
                    </s-table>
                ))}


                <s-button slot="secondary-actions" commandFor="modal" command="--hide">
                    Download Report
                </s-button>
                <s-button
                    slot="primary-action"
                    variant="primary"
                    commandFor="modal"
                    command="--hide"
                >
                    Save Transfers
                </s-button>
            </s-modal>
        </s-section>
    )
}