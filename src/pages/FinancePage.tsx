/* ============================================================
   FamilyBuild — Finance
   ------------------------------------------------------------
   Totals are computed ONLY from active transactions
   (calculations.ts → financeTotals). Cancelled records stay
   visible for audit but are excluded from income/expense/net.
   Editing, cancelling, or restoring a transaction updates
   every dependent total immediately.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { financeTotals } from "../data/calculations";
import type { Transaction } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { formatCurrency, formatDate } from "../utils/format";

export function FinancePage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [tab, setTab] = useState<"all" | "income" | "expenses">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  if (!user || user.role !== "owner") return null;

  const totals = useMemo(() => financeTotals(data.transactions), [data.transactions]);

  const filtered = data.transactions.filter((tx) => tab === "all" || tx.type === tab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Finance</h1>
          <p className="page-header__subtitle">
            Track income, expenses, and financial performance across the portfolio. Internal — not visible to clients or workers.
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
            + Record Transaction
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Total Income</div>
          <div className="stat__value" style={{ color: "var(--success)" }}>{formatCurrency(totals.income)}</div>
          <div className="stat__hint">Active transactions only</div>
        </div>
        <div className="stat">
          <div className="stat__label">Total Expenses</div>
          <div className="stat__value" style={{ color: "var(--danger)" }}>{formatCurrency(totals.expenses)}</div>
          <div className="stat__hint">Active transactions only</div>
        </div>
        <div className="stat">
          <div className="stat__label">Net Position</div>
          <div className="stat__value">{formatCurrency(totals.net)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Transactions</div>
          <div className="stat__value">{data.transactions.length}</div>
          <div className="stat__hint">
            {data.transactions.filter((t) => t.status === "cancelled").length} cancelled (excluded)
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(["all", "income", "expenses"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
            {t === "all" ? "All Transactions" : t === "income" ? "Income" : "Expenses"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="💰"
          title={data.transactions.length === 0 ? "No transactions yet" : "No transactions in this view"}
          text={
            data.transactions.length === 0
              ? "Record income and expenses to track your financial position."
              : "Try a different tab."
          }
          action={
            data.transactions.length === 0 ? (
              <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
                + Record Transaction
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
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Property</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const property = data.propertyById(tx.propertyId ?? "");
                  const project = data.projectById(tx.projectId ?? "");
                  const cancelled = tx.status === "cancelled";
                  return (
                    <tr key={tx.id} style={cancelled ? { opacity: 0.55 } : undefined}>
                      <td>{formatDate(tx.date)}</td>
                      <td>{tx.description}</td>
                      <td>{tx.category}</td>
                      <td>{tx.type}</td>
                      <td>{property?.name ?? "—"}</td>
                      <td>{project?.name ?? "—"}</td>
                      <td
                        style={{
                          fontWeight: 500,
                          color: cancelled ? "var(--text-subtle)" : tx.type === "income" ? "var(--success)" : "var(--danger)",
                        }}
                      >
                        {tx.type === "income" ? "+" : "−"}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td>
                        <StatusBadge status={tx.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => {
                              setEditing(tx);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          {cancelled ? (
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => {
                                data.setTransactionStatus(tx.id, "active");
                                showToast("Transaction restored — totals updated", "success");
                              }}
                            >
                              Restore
                            </button>
                          ) : (
                            <button className="btn btn--ghost btn--sm" onClick={() => setCancelTarget(tx)}>
                              Cancel
                            </button>
                          )}
                          <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(tx)}>
                            Delete
                          </button>
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
        <TransactionFormModal
          transaction={editing}
          properties={data.properties}
          projects={data.projects}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={(input) => {
            if (editing) {
              data.updateTransaction(editing.id, input);
              showToast("Transaction updated — totals updated", "success");
            } else {
              data.addTransaction(input);
              showToast("Transaction recorded", "success");
            }
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel transaction?"
          message={`"${cancelTarget.description}" (${formatCurrency(cancelTarget.amount)}) will be excluded from all totals but kept for audit. You can restore it later.`}
          confirmLabel="Cancel transaction"
          danger
          onConfirm={() => {
            data.setTransactionStatus(cancelTarget.id, "cancelled");
            showToast("Transaction cancelled — totals updated", "info");
          }}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete transaction?"
          message={`"${deleteTarget.description}" (${formatCurrency(deleteTarget.amount)}) will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            data.deleteTransaction(deleteTarget.id);
            showToast("Transaction deleted", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function TransactionFormModal({
  transaction,
  properties,
  projects,
  onClose,
  onSubmit,
}: {
  transaction: Transaction | null;
  properties: ReturnType<typeof useData>["properties"];
  projects: ReturnType<typeof useData>["projects"];
  onClose: () => void;
  onSubmit: (input: Omit<Transaction, "id" | "status">) => void;
}) {
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [category, setCategory] = useState(transaction?.category ?? "Materials");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [propertyId, setPropertyId] = useState(transaction?.propertyId ?? "");
  const [projectId, setProjectId] = useState(transaction?.projectId ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!description.trim()) errs.push("Description is required.");
    if (Number.isNaN(Number(amount)) || amount === "" || Number(amount) <= 0)
      errs.push("Amount must be a positive number.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit({
      date,
      description: description.trim(),
      category: category.trim() || (type === "income" ? "Other Income" : "Other Expense"),
      amount: Number(amount),
      type,
      propertyId: propertyId || undefined,
      projectId: projectId || undefined,
    });
  };

  return (
    <Modal
      title={transaction ? "Edit transaction" : "Record transaction"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {transaction ? "Save changes" : "Record"}
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
        <div className="form-group">
          <label htmlFor="tx-type">Type</label>
          <select id="tx-type" value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="tx-amount">Amount (₱) *</label>
          <input id="tx-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="tx-desc">Description *</label>
          <input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Cement purchase — Riverside Renovation" />
        </div>
        <div className="form-group">
          <label htmlFor="tx-category">Category</label>
          <input id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="tx-date">Date</label>
          <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="tx-property">Property</label>
          <select id="tx-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">None</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="tx-project">Project</label>
          <select id="tx-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}