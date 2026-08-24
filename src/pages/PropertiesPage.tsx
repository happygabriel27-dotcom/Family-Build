import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { Property, PropertyStatus, PropertyType } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { formatCurrency } from "../utils/format";

const PROPERTY_TYPES: PropertyType[] = ["Residential", "Commercial", "Land", "Mixed-Use"];
const PROPERTY_STATUSES: PropertyStatus[] = ["active", "inactive", "archived"];

export function PropertiesPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [tab, setTab] = useState<"all" | PropertyStatus>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const canManage = user.role === "owner";

  /* Builder sees properties tied to their projects. */
  const visibleProperties = useMemo(() => {
    if (user.role === "owner") return data.properties;
    const myProjectProps = new Set(
      data.projects.filter((p) => p.builderId === myId).map((p) => p.propertyId),
    );
    return data.properties.filter((p) => myProjectProps.has(p.id));
  }, [user.role, data.properties, data.projects, myId]);

  const filtered = visibleProperties.filter((p) => {
    const matchesTab = tab === "all" || p.status === tab;
    const matchesSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Properties</h1>
          <p className="page-header__subtitle">
            {canManage
              ? "Manage all properties, their projects, requests, and financial information."
              : "Properties where your projects are located."}
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search properties"
          />
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + Add Property
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(["all", "active", "inactive", "archived"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
            {t === "all" ? "All Properties" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏠"
          title={visibleProperties.length === 0 ? "No properties yet" : "No properties found"}
          text={
            visibleProperties.length === 0
              ? "Add a property to start tracking projects and finances."
              : "Try adjusting your search or filter."
          }
          action={
            canManage && visibleProperties.length === 0 ? (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                + Add Property
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
                  <th>Property</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Projects</th>
                  <th>Open Issues</th>
                  <th>Current Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((property) => {
                  const owner = data.personById(property.ownerId);
                  const projectCount = data.projects.filter((pr) => pr.propertyId === property.id).length;
                  const openIssues = data.requests.filter(
                    (r) =>
                      r.propertyId === property.id &&
                      r.kind === "problem" &&
                      r.status !== "resolved" &&
                      r.status !== "closed",
                  ).length;
                  return (
                    <tr key={property.id}>
                      <td>
                        <Link to={`/properties/${property.id}`} style={{ fontWeight: 500 }}>
                          {property.name}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{property.address}</div>
                      </td>
                      <td>{property.type}</td>
                      <td>
                        <StatusBadge status={property.status} />
                      </td>
                      <td>{owner?.name ?? "—"}</td>
                      <td>{projectCount}</td>
                      <td>{openIssues > 0 ? <span className="text-danger">{openIssues} open</span> : "0"}</td>
                      <td>{formatCurrency(property.currentValue)}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/properties/${property.id}`} className="btn btn--ghost btn--sm">
                            View
                          </Link>
                          {canManage && (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                  setEditing(property);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(property)}>
                                Delete
                              </button>
                            </>
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

      {formOpen && (
        <PropertyFormModal
          property={editing}
          owners={data.people.filter((p) => p.kind === "property-owner")}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editing) {
              data.updateProperty(editing.id, input);
              showToast("Property updated", "success");
            } else {
              data.addProperty(input);
              showToast("Property added", "success");
            }
            setFormOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete property?"
          message={`"${deleteTarget.name}" will be removed from the demo workspace. Projects linked to it remain but lose their property reference.`}
          confirmLabel="Delete property"
          danger
          onConfirm={() => {
            data.deleteProperty(deleteTarget.id);
            showToast("Property deleted", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function PropertyFormModal({
  property,
  owners,
  onClose,
  onSubmit,
}: {
  property: Property | null;
  owners: ReturnType<typeof useData>["people"];
  onClose: () => void;
  onSubmit: (input: Omit<Property, "id">) => void;
}) {
  const [name, setName] = useState(property?.name ?? "");
  const [address, setAddress] = useState(property?.address ?? "");
  const [type, setType] = useState<PropertyType>(property?.type ?? "Residential");
  const [status, setStatus] = useState<PropertyStatus>(property?.status ?? "active");
  const [ownerId, setOwnerId] = useState(property?.ownerId ?? owners[0]?.id ?? "");
  const [purchaseCost, setPurchaseCost] = useState(String(property?.purchaseCost ?? ""));
  const [currentValue, setCurrentValue] = useState(String(property?.currentValue ?? ""));
  const [monthlyIncome, setMonthlyIncome] = useState(String(property?.monthlyIncome ?? "0"));
  const [monthlyExpenses, setMonthlyExpenses] = useState(String(property?.monthlyExpenses ?? "0"));
  const [acquiredDate, setAcquiredDate] = useState(property?.acquiredDate ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(property?.description ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!address.trim()) errs.push("Address is required.");
    if (!ownerId) errs.push("Choose an owner.");
    if (Number.isNaN(Number(purchaseCost)) || purchaseCost === "") errs.push("Purchase cost must be a number.");
    if (Number.isNaN(Number(currentValue)) || currentValue === "") errs.push("Current value must be a number.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      name: name.trim(),
      address: address.trim(),
      type,
      status,
      ownerId,
      purchaseCost: Number(purchaseCost),
      currentValue: Number(currentValue),
      monthlyIncome: Number(monthlyIncome) || 0,
      monthlyExpenses: Number(monthlyExpenses) || 0,
      acquiredDate,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      wide
      title={property ? "Edit property" : "Add property"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {property ? "Save changes" : "Add property"}
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
          <label htmlFor="prop-name">Name *</label>
          <input id="prop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Residence" />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="prop-address">Address *</label>
          <input id="prop-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="prop-type">Type</label>
          <select id="prop-type" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="prop-status">Status</label>
          <select id="prop-status" value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus)}>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="prop-owner">Owner *</label>
          <select id="prop-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="prop-acquired">Acquired date</label>
          <input id="prop-acquired" type="date" value={acquiredDate} onChange={(e) => setAcquiredDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="prop-cost">Purchase cost (₱) *</label>
          <input id="prop-cost" inputMode="numeric" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="prop-value">Current value (₱) *</label>
          <input id="prop-value" inputMode="numeric" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="prop-income">Monthly income (₱)</label>
          <input id="prop-income" inputMode="numeric" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="prop-expenses">Monthly expenses (₱)</label>
          <input id="prop-expenses" inputMode="numeric" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="prop-desc">Description</label>
          <textarea id="prop-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}