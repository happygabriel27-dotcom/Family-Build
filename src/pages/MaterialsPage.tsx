import { useMemo } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { itemStockStatus, lowStockItems } from "../data/calculations";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency } from "../utils/format";

/** Worker-facing read-only materials view for their assigned projects. */
export function MaterialsPage() {
  const { user } = useApp();
  const data = useData();

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const myProjects = useMemo(
    () => data.projects.filter((p) => p.workerIds.includes(myId)),
    [data.projects, myId],
  );

  const myProjectIds = myProjects.map((p) => p.id);
  const relevantOrders = data.purchaseOrders.filter(
    (o) => o.projectId && myProjectIds.includes(o.projectId),
  );

  const lowStock = lowStockItems(data.inventory, data.inventoryTransactions);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Materials</h1>
          <p className="page-header__subtitle">
            Warehouse stock and material orders for your projects. Ask your builder if you need something that isn't here.
          </p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card card--warning">
          <div className="card__header">
            <h2 className="card__title">Low Stock Alert</h2>
          </div>
          <p style={{ fontSize: 13.5 }}>
            {lowStock.length} item{lowStock.length > 1 ? "s are" : " is"} at or below minimum. Tell your builder so a purchase can be arranged.
          </p>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Warehouse stock</h2>
        </div>
        {data.inventory.length === 0 ? (
          <EmptyState icon="📦" title="No materials tracked yet" text="Stock will appear here once the team adds inventory." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((item) => {
                  const entry = itemStockStatus(item, data.inventoryTransactions);
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>
                        {entry.level.current} {item.unit}
                      </td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td>{item.location}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Material orders on your projects</h2>
        </div>
        {relevantOrders.length === 0 ? (
          <EmptyState icon="🛒" title="No material orders yet" text="Orders for your projects will appear here." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Project</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {relevantOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 500 }}>{order.id.toUpperCase()}</td>
                    <td>{data.projectById(order.projectId ?? "")?.name ?? "—"}</td>
                    <td>{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}