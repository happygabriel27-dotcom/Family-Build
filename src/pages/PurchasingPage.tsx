import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { PurchaseOrder, PurchaseOrderStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { formatCurrency, formatDate } from "../utils/format";

const TABS: { key: "all" | PurchaseOrderStatus; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "pending", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "purchased", label: "Purchased" },
  { key: "delivered", label: "Received" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "draft", label: "Drafts" },
];

export function PurchasingPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [tab, setTab] = useState<"all" | PurchaseOrderStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  /* Builders see their own requests; owner sees everything. */
  const visibleOrders = useMemo(() => {
    if (role === "owner") return data.purchaseOrders;
    return data.purchaseOrders.filter((o) => o.requestedById === myId);
  }, [role, data.purchaseOrders, myId]);

  const filtered = visibleOrders.filter((o) => tab === "all" || o.status === tab);
  const pendingCount = visibleOrders.filter((o) => o.status === "pending").length;

  const detail = detailId ? data.purchaseOrders.find((o) => o.id === detailId) : null;

  const act = (order: PurchaseOrder, status: PurchaseOrderStatus) => {
    data.setPurchaseOrderStatus(order.id, status, myId);
    showToast(
      status === "delivered"
        ? `Delivery received — stock added to inventory and expense recorded`
        : `Purchase order ${status}`,
      status === "rejected" || status === "cancelled" ? "info" : "success",
    );
    setDetailId(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Purchasing</h1>
          <p className="page-header__subtitle">
            {role === "owner"
              ? "Review material purchase requests, approve spending, and confirm deliveries."
              : "Request materials for your projects and track approvals and deliveries."}
          </p>
        </div>
        <div className="page-header__actions">
          <button
            className="btn btn--primary"
            onClick={() => setFormOpen(true)}
          >
            + New Purchase Request
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
            {t.key === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🛒"
          title={visibleOrders.length === 0 ? "No purchase orders yet" : "No orders in this view"}
          text={
            visibleOrders.length === 0
              ? "Create a purchase request to start tracking material procurement."
              : "Try a different tab."
          }
          action={
            visibleOrders.length === 0 ? (
              <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
                + New Purchase Request
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Requested by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const project = data.projectById(order.projectId ?? "");
                  return (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 500 }}>{order.id.toUpperCase()}</td>
                      <td>{order.supplier}</td>
                      <td>{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</td>
                      <td>{formatCurrency(order.total)}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>{formatDate(order.date)}</td>
                      <td>{project?.name ?? "—"}</td>
                      <td>{data.actorName(order.requestedById)}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => setDetailId(order.id)}>
                            View
                          </button>
                          {role === "owner" && order.status === "pending" && (
                            <>
                              <button className="btn btn--ghost btn--sm" onClick={() => act(order, "approved")}>
                                Approve
                              </button>
                              <button className="btn btn--ghost btn--sm" onClick={() => act(order, "rejected")}>
                                Reject
                              </button>
                            </>
                          )}
                          {(role === "owner" || role === "manager") &&
                            ["pending", "approved", "purchased"].includes(order.status) && (
                              <button className="btn btn--ghost btn--sm" onClick={() => act(order, "cancelled")}>
                                Cancel
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Detail / workflow modal ---------- */}
      {detail && (
        <Modal
          wide
          title={`Purchase order ${detail.id.toUpperCase()}`}
          subtitle={`${detail.supplier} · ${formatDate(detail.date)}`}
          onClose={() => setDetailId(null)}
          footer={
            <>
              {role === "owner" && detail.status === "pending" && (
                <>
                  <button type="button" className="btn btn--danger" onClick={() => act(detail, "rejected")}>
                    Reject
                  </button>
                  <button type="button" className="btn btn--primary" onClick={() => act(detail, "approved")}>
                    Approve
                  </button>
                </>
              )}
              {(role === "owner" || role === "manager") && detail.status === "approved" && (
                <button type="button" className="btn btn--primary" onClick={() => act(detail, "purchased")}>
                  Mark purchased (ordered)
                </button>
              )}
              {(role === "owner" || role === "manager") &&
                ["approved", "purchased"].includes(detail.status) && (
                  <button type="button" className="btn btn--primary" onClick={() => act(detail, "delivered")}>
                    Mark received — add stock & record expense
                  </button>
                )}
              {(role === "owner" || role === "manager") &&
                ["pending", "approved", "purchased"].includes(detail.status) && (
                  <button type="button" className="btn btn--danger" onClick={() => act(detail, "cancelled")}>
                    Cancel order
                  </button>
                )}
              <button type="button" className="btn btn--secondary" onClick={() => setDetailId(null)}>
                Close
              </button>
            </>
          }
        >
          <div className="info-grid" style={{ marginBottom: 16 }}>
            <div className="info-item">
              <div className="info-item__label">Status</div>
              <div className="info-item__value">
                <StatusBadge status={detail.status} />
              </div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Requested by</div>
              <div className="info-item__value">{data.actorName(detail.requestedById)}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Project</div>
              <div className="info-item__value">{data.projectById(detail.projectId ?? "")?.name ?? "—"}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Total</div>
              <div className="info-item__value">{formatCurrency(detail.total)}</div>
            </div>
          </div>

          <div className="table-scroll" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, idx) => (
                  <tr key={`${item.name}-${idx}`}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitCost)}</td>
                    <td>{formatCurrency(item.quantity * item.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.notes && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <strong>Notes:</strong> {detail.notes}
            </p>
          )}

          {detail.receivedTxId && (
            <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 8 }}>
              Expense automatically recorded in Finance when this delivery was received.
            </p>
          )}
          {role === "owner" && detail.status === "pending" && (
            <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 8 }}>
              Workflow: Requested → Approved → Purchased → Received. Receiving adds stock to inventory and records the expense in Finance automatically.
            </p>
          )}
        </Modal>
      )}

      {formOpen && (
        <PurchaseFormModal
          projects={data.projects.filter((p) =>
            role === "manager" ? p.builderId === myId : true,
          )}
          inventory={data.inventory}
          defaultRequesterId={myId}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            data.addPurchaseOrder(input);
            showToast("Purchase request submitted for approval", "success");
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PurchaseFormModal({
  projects,
  inventory,
  defaultRequesterId,
  onClose,
  onSubmit,
}: {
  projects: ReturnType<typeof useData>["projects"];
  inventory: ReturnType<typeof useData>["inventory"];
  defaultRequesterId: string;
  onClose: () => void;
  onSubmit: (input: Omit<PurchaseOrder, "id">) => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [lines, setLines] = useState<{ inventoryItemId?: string; name: string; quantity: string; unitCost: string }[]>([
    { name: "", quantity: "", unitCost: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const pickInventoryItem = (index: number, itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? item
            ? { ...line, inventoryItemId: item.id, name: item.name, unitCost: String(item.costPerUnit) }
            : { ...line, inventoryItemId: undefined }
          : line,
      ),
    );
  };

  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0),
    0,
  );

  const submit = () => {
    const errs: string[] = [];
    if (!supplier.trim()) errs.push("Supplier is required.");
    const validLines = lines.filter((l) => l.name.trim() && Number(l.quantity) > 0 && Number(l.unitCost) >= 0);
    if (validLines.length === 0) errs.push("Add at least one item with name, quantity, and unit cost.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      supplier: supplier.trim(),
      items: validLines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        name: l.name.trim(),
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      })),
      total,
      status: "pending",
      date: new Date().toISOString().slice(0, 10),
      projectId: projectId || undefined,
      requestedById: defaultRequesterId,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      wide
      title="New purchase request"
      subtitle="Workflow: Requested → Owner approval → Purchased → Received. Receiving updates inventory AND finance automatically."
      onClose={onClose}
      footer={
        <>
          <span style={{ marginRight: "auto", fontWeight: 600 }}>Total: {formatCurrency(total)}</span>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Submit request
          </button>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          {errors.map((e) => (
            <div key={e}>• {e}</div>
          ))}
        </div>
      )}
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="form-group">
          <label htmlFor="po-supplier">Supplier *</label>
          <input id="po-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Davao Builders Supply" />
        </div>
        <div className="form-group">
          <label htmlFor="po-project">Project</label>
          <select id="po-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card__header">
        <h3 className="card__title">Items</h3>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setLines((prev) => [...prev, { name: "", quantity: "", unitCost: "" }])}
        >
          + Add line
        </button>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="po-line">
          <select
            value={line.inventoryItemId ?? ""}
            onChange={(e) => pickInventoryItem(index, e.target.value)}
            aria-label="Pick inventory item"
          >
            <option value="">Custom item…</option>
            {inventory.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.supplier})
              </option>
            ))}
          </select>
          <input
            value={line.name}
            onChange={(e) => updateLine(index, { name: e.target.value })}
            placeholder="Item name"
            aria-label="Item name"
          />
          <input
            value={line.quantity}
            onChange={(e) => updateLine(index, { quantity: e.target.value })}
            placeholder="Qty"
            inputMode="numeric"
            aria-label="Quantity"
          />
          <input
            value={line.unitCost}
            onChange={(e) => updateLine(index, { unitCost: e.target.value })}
            placeholder="Unit cost ₱"
            inputMode="numeric"
            aria-label="Unit cost"
          />
          {lines.length > 1 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
              aria-label="Remove line"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <div className="form-group form-group--full" style={{ marginTop: 14 }}>
        <label htmlFor="po-notes">Notes</label>
        <textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose, delivery expectations…" />
      </div>
    </Modal>
  );
}