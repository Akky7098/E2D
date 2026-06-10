import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { getEnquiries } from "../../services/enquiryService";
import CreateEnquiryModal from "./CreateEnquiryModal";
import "./EnquiryListPage.css";

const cleanPhone = (phone = "") => {
  let value = String(phone || "")
    .replace("@lid", "")
    .replace("@c.us", "")
    .trim();

  if (value.startsWith("91") && value.length > 10) value = value.slice(2);

  return value || "-";
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMake = (value = "") => {
  const map = {
    india_make: "India Make",
    china_make: "China Make",
    german_make: "German Make",
    gloria: "Gloria",
    sbe_german: "SBE German",
    other: "Other",
  };

  return map[value] || "India Make";
};

const formatShape = (value = "") => {
  const map = {
    round: "Round",
    flat: "Flat",
    square: "Square",
    rcs: "RCS",
  };

  return map[value] || "-";
};

const getStatusClass = (status = "") => {
  if (status === "available") return "row-green";
  if (status === "partial_available") return "row-yellow";
  if (status === "not_available") return "row-red";
  if (status === "escalated") return "row-orange";
  if (status === "closed") return "row-grey";
  return "";
};

const getStatusLabel = (status = "") => {
  const map = {
    pending_material_check: "Pending",
    available: "Available",
    partial_available: "Partial",
    not_available: "Not Available",
    escalated: "Escalated",
    closed: "Closed",
  };

  return map[status] || status || "-";
};

function EnquiryListPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 30,
    totalPages: 1,
  });

  const [showCreate, setShowCreate] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [makeOrigin, setMakeOrigin] = useState("");

  const [loading, setLoading] = useState(false);

  const fetchEnquiries = async (page = 1) => {
    try {
      setLoading(true);

      const data = await getEnquiries({
        page,
        limit: 30,
        search,
        status,
        source,
        makeOrigin,
      });

      const list = data?.data?.enquiries || data?.data || [];
      const pageData = data?.data?.pagination || {};

      setEnquiries(Array.isArray(list) ? list : []);

      setPagination({
        total: pageData.total || list.length || 0,
        page: pageData.page || page,
        limit: pageData.limit || 30,
        totalPages: pageData.totalPages || 1,
      });
    } catch (error) {
      alert(error?.response?.data?.message || "Unable to fetch enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries(1);
  }, []);

  return (
    <div className="enq-page">
      <div className="enq-topbar">
        <div>
          <h2>Enquiry Sheet</h2>
          <p>{pagination.total} record(s)</p>
        </div>

        <div className="enq-top-actions">
          <button className="refresh-btn" onClick={() => fetchEnquiries(1)}>
            <RefreshCw size={16} />
          </button>

          <button className="new-btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            New Enquiry
          </button>
        </div>
      </div>

      <form
        className="enq-filter"
        onSubmit={(e) => {
          e.preventDefault();
          fetchEnquiries(1);
        }}
      >
        <div className="enq-search">
          <Search size={16} />
          <input
            placeholder="Search customer, phone, grade, size, enquiry no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending_material_check">Pending</option>
          <option value="available">Available</option>
          <option value="partial_available">Partial</option>
          <option value="not_available">Not Available</option>
          <option value="escalated">Escalated</option>
          <option value="closed">Closed</option>
        </select>

        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All Source</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="manual">Manual</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="image">Image</option>
          <option value="pdf">PDF</option>
          <option value="voice">Voice</option>
        </select>

        <select
          value={makeOrigin}
          onChange={(e) => setMakeOrigin(e.target.value)}
        >
          <option value="">All Make</option>
          <option value="india_make">India Make</option>
          <option value="china_make">China Make</option>
          <option value="german_make">German Make</option>
          <option value="gloria">Gloria</option>
          <option value="sbe_german">SBE German</option>
          <option value="other">Other</option>
        </select>

        <button className="apply-btn">
          <Filter size={15} />
          Apply
        </button>
      </form>

      <div className="enq-table-card">
        <table className="enq-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Make</th>
              <th>Grade</th>
              <th>Shape</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" className="empty-cell">
                  Loading enquiries...
                </td>
              </tr>
            ) : enquiries.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-cell">
                  No enquiry found.
                </td>
              </tr>
            ) : (
              enquiries.map((enq) => {
                const materials = enq.materials?.length
                  ? enq.materials
                  : [{ grade: "-", shape: "-", size: "-", quantity: "-", unit: "" }];

                return materials.map((m, index) => (
                  <tr
                    key={`${enq._id}-${index}`}
                    className={getStatusClass(enq.status)}
                  >
                    {index === 0 && (
                      <>
                        <td rowSpan={materials.length} className="date-col">
                          <strong>{formatDate(enq.createdAt)}</strong>
                          <small>{formatTime(enq.createdAt)}</small>
                          <span>{enq.enquiryNo}</span>
                        </td>

                        <td rowSpan={materials.length} className="customer-col">
                          <strong>{enq.customerName || "Unknown"}</strong>
                          <small>{enq.createdByName || "System"}</small>
                        </td>

                        <td rowSpan={materials.length} className="phone-col">
                          {cleanPhone(enq.customerPhone)}
                        </td>

                        <td rowSpan={materials.length}>
                          <span className="make-badge">
                            {formatMake(enq.makeOrigin)}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="grade-col">{m.grade || "-"}</td>
                    <td>{formatShape(m.shape)}</td>
                    <td className="size-col">{m.size || "-"}</td>
                    <td className="qty-col">
                      {m.quantity || 0} {m.unit || "Nos"}
                    </td>

                    {index === 0 && (
                      <>
                        <td rowSpan={materials.length}>
                          <span className={`status-badge-table ${enq.status}`}>
                            {getStatusLabel(enq.status)}
                          </span>
                        </td>

                        <td rowSpan={materials.length} className="source-col">
                          {enq.source || "-"}
                        </td>
                      </>
                    )}
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-enq-list">
        {enquiries.map((enq) => (
          <div className={`mobile-enq-card ${getStatusClass(enq.status)}`} key={enq._id}>
            <div className="mobile-card-head">
              <div>
                <span>{enq.enquiryNo}</span>
                <h3>{enq.customerName || "Unknown"}</h3>
                <p>
                  {formatDate(enq.createdAt)} · {formatTime(enq.createdAt)}
                </p>
              </div>

              <span className={`status-badge-table ${enq.status}`}>
                {getStatusLabel(enq.status)}
              </span>
            </div>

            <div className="mobile-info-row">
              <span>{cleanPhone(enq.customerPhone)}</span>
              <span>{formatMake(enq.makeOrigin)}</span>
              <span>{enq.source || "-"}</span>
            </div>

            <div className="mobile-material-grid">
              {(enq.materials || []).map((m, index) => (
                <div key={index}>
                  <b>{m.grade || "-"}</b>
                  <span>{formatShape(m.shape)}</span>
                  <p>{m.size || "-"}</p>
                  <strong>
                    {m.quantity || 0} {m.unit || "Nos"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="enq-pagination">
        <button
          disabled={pagination.page <= 1}
          onClick={() => fetchEnquiries(pagination.page - 1)}
        >
          <ChevronLeft size={15} />
          Prev
        </button>

        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>

        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => fetchEnquiries(pagination.page + 1)}
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>

      <button className="mobile-floating-new" onClick={() => setShowCreate(true)}>
        <Plus size={25} />
      </button>

      {showCreate && (
        <CreateEnquiryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchEnquiries(1);
          }}
        />
      )}
    </div>
  );
}

export default EnquiryListPage;