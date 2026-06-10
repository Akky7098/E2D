import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createManualEnquiry,
  getActiveSheds,
  getProductGrades,
} from "../../services/enquiryService";
import "./CreateEnquiryModal.css";

const emptyMaterial = {
  category: "tool_and_die_steel",
  grade: "",
  otherGrade: "",
  shape: "round",
  size: "",
  quantity: "",
  unit: "Nos",
  manualShedIds: [],
};

const categoryLabels = {
  tool_and_die_steel: "Tool & Die Steel",
  plastic_mould_steel: "Plastic Mould Steel",
  high_speed_steel: "High Speed Steel",
  alloy_steel: "Alloy Steel",
  carbon_steel: "Carbon Steel",
  other: "Other",
};

function CreateEnquiryModal({ onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState({});
  const [sheds, setSheds] = useState([]);

  const [form, setForm] = useState({
    makeOrigin: "india_make",
    customerName: "",
    customerPhone: "",
    rawMessage: "",
    materials: [{ ...emptyMaterial }],
  });

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [gradeRes, shedRes] = await Promise.all([
        getProductGrades(),
        getActiveSheds(),
      ]);

      setGrades(gradeRes?.data || {});
      setSheds(shedRes?.data || []);
    } catch (error) {
      console.log("Master load error", error);
    }
  };

  const updateMaterial = (index, key, value) => {
    const updated = [...form.materials];

    updated[index] = {
      ...updated[index],
      [key]: value,
    };

    if (key === "category") {
      updated[index].grade = "";
      updated[index].otherGrade = "";
    }

    setForm({ ...form, materials: updated });
  };

  const toggleShed = (index, shedId) => {
    const updated = [...form.materials];
    const selected = updated[index].manualShedIds || [];

    updated[index].manualShedIds = selected.includes(shedId)
      ? selected.filter((id) => id !== shedId)
      : [...selected, shedId];

    setForm({ ...form, materials: updated });
  };

  const addLine = () => {
    setForm({
      ...form,
      materials: [...form.materials, { ...emptyMaterial }],
    });
  };

  const removeLine = (index) => {
    setForm({
      ...form,
      materials:
        form.materials.length === 1
          ? [{ ...emptyMaterial }]
          : form.materials.filter((_, i) => i !== index),
    });
  };

  const submit = async (e) => {
    e.preventDefault();

    const materials = form.materials
      .filter((m) => m.grade || m.otherGrade || m.size)
      .map((m) => ({
        ...m,
        grade: m.grade === "other" ? m.otherGrade : m.grade,
        quantity: Number(m.quantity) || 0,
      }));

    if (!form.customerName.trim()) {
      alert("Customer name is required");
      return;
    }

    if (materials.length === 0) {
      alert("Add at least one material line");
      return;
    }

    try {
      setSaving(true);

      await createManualEnquiry({
        ...form,
        materials,
      });

      onCreated();
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to create enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-enquiry-backdrop">
      <div className="create-enquiry-modal">
        <div className="create-modal-header">
          <div>
            <span>Manual Entry</span>
            <h3>Create Enquiry</h3>
            <p>Add multiple material lines and optional shed assignment.</p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit}>
          <section className="customer-section">
            <div>
              <label>Make</label>
              <select
                value={form.makeOrigin}
                onChange={(e) =>
                  setForm({ ...form, makeOrigin: e.target.value })
                }
              >
                <option value="india_make">India Make</option>
                <option value="china_make">China Make</option>
                <option value="german_make">German Make</option>
                <option value="gloria">Gloria</option>
                <option value="sbe_german">SBE German</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label>Customer Name *</label>
              <input
                value={form.customerName}
                onChange={(e) =>
                  setForm({ ...form, customerName: e.target.value })
                }
                placeholder="ABC Auto Components"
              />
            </div>

            <div>
              <label>Phone</label>
              <input
                value={form.customerPhone}
                onChange={(e) =>
                  setForm({ ...form, customerPhone: e.target.value })
                }
                placeholder="9876543210"
              />
            </div>
          </section>

          <section className="notes-section">
            <label>Raw Message / Notes</label>
            <textarea
              value={form.rawMessage}
              onChange={(e) =>
                setForm({ ...form, rawMessage: e.target.value })
              }
              placeholder="Example: EN31 dia 90 - 2 pcs..."
            />
          </section>

          <section className="material-section-head">
            <div>
              <h4>Material Lines</h4>
              <p>Category, grade, shape, size and quantity.</p>
            </div>

            <button type="button" onClick={addLine}>
              <Plus size={16} />
              Add Line
            </button>
          </section>

          <section className="material-line-list">
            {form.materials.map((m, index) => {
              const gradeOptions = grades[m.category] || [];

              return (
                <div className="material-entry-card" key={index}>
                  <div className="material-entry-top">
                    <span>Line #{index + 1}</span>

                    <button
                      type="button"
                      className="line-delete-btn"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="material-entry-grid">
                    <select
                      value={m.category}
                      onChange={(e) =>
                        updateMaterial(index, "category", e.target.value)
                      }
                    >
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={m.grade}
                      onChange={(e) =>
                        updateMaterial(index, "grade", e.target.value)
                      }
                    >
                      <option value="">Select Grade</option>
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>

                    {m.grade === "other" && (
                      <input
                        value={m.otherGrade}
                        onChange={(e) =>
                          updateMaterial(index, "otherGrade", e.target.value)
                        }
                        placeholder="Other Grade"
                      />
                    )}

                    <select
                      value={m.shape}
                      onChange={(e) =>
                        updateMaterial(index, "shape", e.target.value)
                      }
                    >
                      <option value="round">Round</option>
                      <option value="flat">Flat</option>
                      <option value="square">Square</option>
                      <option value="rcs">RCS</option>
                    </select>

                    <input
                      value={m.size}
                      onChange={(e) =>
                        updateMaterial(index, "size", e.target.value)
                      }
                      placeholder="Size e.g. dia 90 / 250x250x700"
                    />

                    <input
                      type="number"
                      value={m.quantity}
                      onChange={(e) =>
                        updateMaterial(index, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                    />

                    <select
                      value={m.unit}
                      onChange={(e) =>
                        updateMaterial(index, "unit", e.target.value)
                      }
                    >
                      <option value="Nos">Nos</option>
                      <option value="Kg">Kg</option>
                      <option value="Meter">Meter</option>
                    </select>
                  </div>

                  <div className="shed-box">
                    <div>
                      <strong>Manual Shed Assignment</strong>
                      <small>
                        Leave blank for auto shed by category. Select multiple
                        sheds if required.
                      </small>
                    </div>

                    <div className="shed-chip-wrap">
                      {sheds.length === 0 ? (
                        <span className="no-shed-text">No active sheds found</span>
                      ) : (
                        sheds.map((shed) => (
                          <button
                            type="button"
                            key={shed._id}
                            className={
                              m.manualShedIds?.includes(shed._id)
                                ? "shed-chip active"
                                : "shed-chip"
                            }
                            onClick={() => toggleShed(index, shed._id)}
                          >
                            {shed.name || shed.shedName || "Shed"}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <div className="create-modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>

            <button className="save-btn" disabled={saving}>
              {saving ? "Creating..." : "Create Enquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateEnquiryModal;