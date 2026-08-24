/* ============================================================
   FamilyBuild — Inventory
   ------------------------------------------------------------
   Current quantity is DERIVED from opening + movement ledger
   (calculations.ts). Actions record real movements:
   Stock In / Stock Out / Adjustment / Transfer.
   Low-stock status recalculates automatically and notifies.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { itemStockStatus, lowStockItems, type StockLevel } from "../data/calculations";
import type { InventoryItem, StockMovementKind, StockStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { formatCurrency, formatDate } from "../utils/format";

const MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  "stock-in": "Stock In",
  "stock-out": "Stock Out",
  adjustment: "Adjustment",
  "transfer-in": "Transfer In",
  "transfer-out": "Transfer Out",
};

export function InventoryPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [moving, setMoving] = useState<{ item: InventoryItem; kind: StockMovementKind } | null>(null);
  const [historyOf, setHistoryOf] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const canManage = user.role === "owner" || user.role === "manager";

  /* Derived stock levels for every item — never stored by hand. */
  const levels = useMemo(() => {
    const map = new Map<string, { level: StockLevel; status: StockStatus }>();
    data.inventory.forEach((item) => {
      map.set(item.id, itemStockStatus(item, data.inventoryTransactions));
    });
    return map;
  }, [data.inventory, data.inventoryTransactions]);

  const lowCount = lowStockItems(data.inventory, data.inventoryTransactions).length;

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(data.inventory.map((i) => i.category)))],
    [data.inventory],
  );

  const filtered = data.inventory.filter((item) => {
    const matchesSearch =
      search.trim() === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || item.category === category;
    const status = levels.get(item.id)?.status ?? "in-stock";
    const matchesStock = stockFilter === "all" || status === stockFilter;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const openMovement = (item: InventoryItem, kind: StockMovementKind) => setMoving({ item, kind });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Inventory</h1>
          <p className="page-header__subtitle">
            Track materials with a full stock-movement ledger. Current quantities are calculated
            from every stock in, out, adjustment, and transfer.
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search inventory"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="toolbar-select" aria-label="Filter by category">
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="toolbar-select" aria-label="Filter by stock status">
            <option value="all">All stock levels</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {lowCount > 0 && (
        <div className="card card--warning">
          <div className="card__header">
            <h2 className="card__title">Low Stock Alert</h2>
          </div>
          <p style={{ fontSize: 13.5 }}>
            {lowCount} item{lowCount > 1 ? "s are" : " is"} at or below the minimum level. Consider placing a purchase order.
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title={data.inventory.length === 0 ? "No inventory items yet" : "No items match your filters"}
          text={
            data.inventory.length === 0
              ? "Add materials and supplies to track stock levels."
              : "Try adjusting your search or filters."
          }
          action={
            canManage && data.inventory.length === 0 ? (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                + Add Item
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
                  <th>Item</th>
                  <th>Category</th>
                  <th>Current Qty</th>
                  <th>Min. Stock</th>
                  <th>Status</th>
                  <th>Cost / Unit</th>
                  <th>Supplier</th>
                  <th>Location</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const entry = levels.get(item.id)!;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td>
                        <strong>{entry.level.current}</strong> {item.unit}
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ display: "block", padding: 0, fontSize: 11 }}
                          onClick={() => setHistoryOf(item)}
                        >
                          View ledger ({data.inventoryTransactions.filter((t) => t.itemId === item.id).length})
                        </button>
                      </td>
                      <td>{item.minStock}</td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td>{formatCurrency(item.costPerUnit)}</td>
                      <td>{item.supplier}</td>
                      <td>{item.location}</td>
                      {canManage && (
                        <td>
                          <div className="table-actions">
                            <button className="btn btn--ghost btn--sm" onClick={() => openMovement(item, "stock-in")}>
                              Stock In
                            </button>
                            <button className="btn btn--ghost btn--sm" onClick={() => openMovement(item, "stock-out")}>
                              Stock Out
                            </button>
                            <button className="btn btn--ghost btn--sm" onClick={() => openMovement(item, "adjustment")}>
                              Adjust
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => {
                                setEditing(item);
                                setFormOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(item)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Create / edit modal ---------- */}
      {formOpen && (
        <ItemFormModal
          item={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editing) {
              data.updateInventoryItem(editing.id, input);
              showToast("Item updated", "success");
            } else {
              data.addInventoryItem(input);
              showToast("Item added to inventory", "success");
            }
            setFormOpen(false);
          }}
        />
      )}

      {/* ---------- Stock movement modal ---------- */}
      {moving && (
        <StockMovementModal
          item={moving.item}
          kind={moving.kind}
          level={levels.get(moving.item.id)!.level}
          onClose={() => setMoving(null)}
          onSubmit={(delta, reason) => {
            data.recordStockMovement(moving.item.id, moving.kind, delta, reason, myId);
            showToast(`${MOVEMENT_LABELS[moving.kind]} recorded for ${moving.item.name}`, "success");
            setMoving(null);
          }}
        />
      )}

      {/* ---------- Movement ledger modal ---------- */}
      {historyOf && (
        <LedgerModal
          item={historyOf}
          movements={data.inventoryTransactions.filter((t) => t.itemId === historyOf.id)}
          level={levels.get(historyOf.id)!.level}
          onClose={() => setHistoryOf(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Remove inventory item?"
          message={`"${deleteTarget.name}" and its movement history will be removed from the demo workspace.`}
          confirmLabel="Remove item"
          danger
          onConfirm={() => {
            data.deleteInventoryItem(deleteTarget.id);
            showToast("Item removed", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ItemFormModal({
  item,
  onClose,
  onSubmit,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSubmit: (input: Omit<InventoryItem, "id">) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "Materials");
  const [openingQuantity, setOpeningQuantity] = useState(String(item?.openingQuantity ?? "0"));
  const [unit, setUnit] = useState(item?.unit ?? "pcs");
  const [minStock, setMinStock] = useState(String(item?.minStock ?? "10"));
  const [costPerUnit, setCostPerUnit] = useState(String(item?.costPerUnit ?? ""));
  const [supplier, setSupplier] = useState(item?.supplier ?? "");
  const [location, setLocation] = useState(item?.location ?? "Main Warehouse");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!supplier.trim()) errs.push("Supplier is required.");
    if (Number.isNaN(Number(openingQuantity)) || openingQuantity === "")
      errs.push("Opening quantity must be a number.");
    if (Number.isNaN(Number(costPerUnit)) || costPerUnit === "") errs.push("Cost per unit must be a number.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit({
      name: name.trim(),
      category: category.trim() || "Materials",
      openingQuantity: Number(openingQuantity),
      unit: unit.trim() || "pcs",
      minStock: Number(minStock) || 0,
      costPerUnit: Number(costPerUnit),
      supplier: supplier.trim(),
      location: location.trim() || "Main Warehouse",
    });
  };

  return (
    <Modal
      title={item ? "Edit inventory item" : "Add inventory item"}
      subtitle={item ? undefined : "Set the opening quantity; current stock is then driven by movements."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {item ? "Save changes" : "Add item"}
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
      <div className="form-grid">
        <div className="form-group form-group--full">
          <label htmlFor="inv-name">Name *</label>
          <input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cement (40kg)" />
        </div>
        <div className="form-group">
          <label htmlFor="inv-category">Category</label>
          <input id="inv-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="inv-qty">{item ? "Opening quantity *" : "Opening quantity * (current start)"}</label>
          <input id="inv-qty" inputMode="numeric" value={openingQuantity} onChange={(e) => setOpeningQuantity(e.target.value)} disabled={Boolean(item)} />
        </div>
        <div className="form-group">
          <label htmlFor="inv-unit">Unit</label>
          <input id="inv-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bags / pcs / meters…" />
        </div>
        <div className="form-group">
          <label htmlFor="inv-min">Minimum stock</label>
          <input id="inv-min" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="inv-cost">Cost per unit (₱) *</label>
          <input id="inv-cost" inputMode="numeric" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="inv-supplier">Supplier *</label>
          <input id="inv-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="inv-location">Location</label>
          <input id="inv-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      {item && (
        <p style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 8 }}>
          Opening quantity is fixed after creation — use Stock In / Adjust movements to change stock.
        </p>
      )}
    </Modal>
  );
}

function StockMovementModal({
  item,
  kind,
  level,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  kind: StockMovementKind;
  level: StockLevel;
  onClose: () => void;
  onSubmit: (quantityDelta: number, reason?: string) => void;
}) {
  const isAdjustment = kind === "adjustment";
  const isInbound = kind === "stock-in" || kind === "transfer-in";

  const [value, setValue] = useState(isAdjustment ? String(level.current) : "");
  const [reason, setReason] = useState("");
  const num = Number(value);
  const valid =
    value !== "" &&
    !Number.isNaN(num) &&
    (isAdjustment ? num >= 0 : num > 0) &&
    (!isInbound || true) &&
    (kind !== "stock-out" && kind !== "transfer-out" ? true : num <= level.current);

  let delta = 0;
  if (valid) {
    if (kind === "stock-in") delta = num;
    else if (kind === "stock-out") delta = -num;
    else if (kind === "transfer-in") delta = num;
    else if (kind === "transfer-out") delta = -num;
    else delta = num - level.current; // adjustment → signed difference
  }

  const projected = Math.max(0, level.current + delta);

  return (
    <Modal
      title={`${MOVEMENT_LABELS[kind]} — ${item.name}`}
      subtitle={`Current: ${level.current} ${item.unit} · Minimum: ${item.minStock}`}
      onClose={onClose}
      footer={
        <>
          <span style={{ marginRight: "auto", fontWeight: 600 }}>
            Projected: {projected} {item.unit}
          </span>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!valid}
            onClick={() => valid && onSubmit(delta, reason.trim() || undefined)}
          >
            Record {MOVEMENT_LABELS[kind]}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group form-group--full">
          <label htmlFor="mv-qty">
            {isAdjustment
              ? `New counted quantity (${item.unit})`
              : `Quantity ${isInbound ? "received" : "issued"} (${item.unit})`}
          </label>
          <input id="mv-qty" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          {!valid && (
            <small className="text-danger">
              {kind === "stock-out" || kind === "transfer-out"
                ? `Enter an amount between 1 and ${level.current}.`
                : "Enter a valid positive number."}
            </small>
          )}
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="mv-reason">Reason / reference</label>
          <input
            id="mv-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isAdjustment
                ? "e.g. Monthly physical count — damaged bags"
                : isInbound
                  ? "e.g. Supplier delivery, PO reference…"
                  : "e.g. Issued to Riverside Renovation crew"
            }
          />
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 8 }}>
        Recorded as a permanent ledger entry. Current quantity is recalculated as
        opening {level.opening} + in {level.stockIn} − out {Math.abs(level.stockOut)} ± adjustments{" "}
        {level.adjustments}.
      </p>
    </Modal>
  );
}

function LedgerModal({
  item,
  movements,
  level,
  onClose,
}: {
  item: InventoryItem;
  movements: ReturnType<typeof useData>["inventoryTransactions"];
  level: StockLevel;
  onClose: () => void;
}) {
  const data = useData();
  const sorted = [...movements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal
      wide
      title={`Stock ledger — ${item.name}`}
      subtitle={`Opening ${level.opening} ${item.unit} → current ${level.current} ${item.unit}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Close
        </button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState icon="📒" title="No movements yet" text="Stock in/out/adjustments will appear here." />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Change</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.date)}</td>
                  <td>{MOVEMENT_LABELS[m.kind]}</td>
                  <td style={{ fontWeight: 600, color: m.quantityDelta >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {m.quantityDelta >= 0 ? "+" : ""}
                    {m.quantityDelta} {item.unit}
                  </td>
                  <td>{m.reason ?? "—"}</td>
                  <td>{m.actorId ? data.actorName(m.actorId) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}