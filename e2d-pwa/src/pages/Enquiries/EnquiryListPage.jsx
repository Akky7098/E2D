import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { getEnquiries } from "../../services/enquiryService";
import CreateEnquiryModal from "./CreateEnquiryModal";
import UpdateMaterialModal from "./UpdateMaterialModal";
import "./EnquiryListPage.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const getAudioUrl = (filePath = "") => {
  if (!filePath) return "";
  if (filePath.startsWith("http")) return filePath;
  return `${BASE_URL}${filePath}`;
};

const cleanPhone = (phone = "") => {
  let value = String(phone || "").replace("@lid", "").replace("@c.us", "").trim();
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
    india: "India Make",
    china: "China Make",
    germany: "German Make",
    gloria: "Gloria",
    sbe_german: "SBE German",
    other: "Other",
  };
  return map[value] || "India Make";
};

const formatShape = (value = "") => {
  const map = { round: "Round", flat: "Flat", square: "Square", rcs: "RCS" };
  return map[value] || "-";
};

const getStatusClass = (status = "") => {
  if (status === "available") return "row-green";
  if (status === "partial_available") return "row-yellow";
  if (status === "not_available") return "row-red";
  if (status === "escalated" || status === "manual_review") return "row-orange";
  if (status === "closed") return "row-grey";
  return "";
};

const getStatusLabel = (status = "") => {
  const map = {
    pending_material_check: "Pending",
    available: "Available",
    partial_available: "Partial",
    not_available: "Not Available",
    manual_review: "Manual Review",
    escalated: "Escalated",
    closed: "Closed",
    exact_available: "Available",
    near_available: "Near Size",
    unclear: "Review",
    pending: "Pending",
  };
  return map[status] || status || "-";
};

const getMaterialCheck = (enq, index) => {
  const check = enq.materialCheckIds?.[index];
  if (!check) return null;
  return typeof check === "string" ? { _id: check } : check;
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
  const [updateItem, setUpdateItem] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [makeOrigin, setMakeOrigin] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedAudio, setSelectedAudio] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef(null);

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

  const openUpdateModal = ({ enq, material, index }) => {
    const check = getMaterialCheck(enq, index);

    if (!check?._id) {
      alert("Material check not found. Please populate materialCheckIds from backend.");
      return;
    }

    setUpdateItem({
      enquiry: enq,
      material,
      materialCheck: check,
      materialCheckId: check._id,
      lineNo: index + 1,
    });
  };

  const openAudioPopup = (filePath) => {
    const url = getAudioUrl(filePath);

    setAudioError("");
    setAudioPlaying(false);
    setSelectedAudio({
      filePath,
      url,
    });

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.load();
      }
    }, 100);
  };

  const closeAudioPopup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setAudioPlaying(false);
    setAudioError("");
    setSelectedAudio(null);
  };

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    try {
      setAudioError("");

      if (audioPlaying) {
        audioRef.current.pause();
        setAudioPlaying(false);
        return;
      }

      await audioRef.current.play();
      setAudioPlaying(true);
    } catch (error) {
      setAudioError("Audio could not play here. Use Open Audio button.");
      setAudioPlaying(false);
    }
  };

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
          <option value="manual_review">Manual Review</option>
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

        <select value={makeOrigin} onChange={(e) => setMakeOrigin(e.target.value)}>
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
              <th>Update Status</th>
              <th>Updated Detail</th>
              <th>Source</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" className="empty-cell">
                  Loading enquiries...
                </td>
              </tr>
            ) : enquiries.length === 0 ? (
              <tr>
                <td colSpan="12" className="empty-cell">
                  No enquiry found.
                </td>
              </tr>
            ) : (
              enquiries.map((enq) => {
                const materials = enq.materials?.length
                  ? enq.materials
                  : [{ grade: "-", shape: "-", size: "-", quantity: "-", unit: "" }];

                return materials.map((m, index) => {
                  const check = getMaterialCheck(enq, index);
                  const av = check?.availability || {};
                  const updateStatus = av.status || check?.status || "pending";

                  return (
                    <tr key={`${enq._id}-${index}`} className={getStatusClass(enq.status)}>
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
                              {formatMake(enq.makeOrigin || enq.customerType)}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="grade-col">{m.grade || "-"}</td>
                      <td className="shape-col">{formatShape(m.shape)}</td>
                      <td className="size-col">{m.size || "-"}</td>
                      <td className="qty-col">
                        {m.quantity || 0} {m.unit || "Nos"}
                      </td>

                      <td>
                        <span className={`line-status-pill ${updateStatus}`}>
                          {getStatusLabel(updateStatus)}
                        </span>
                      </td>

                      <td className="update-detail-col">
                        {av.status && av.status !== "pending" ? (
                          <>
                            <b>
                              {av.availableQuantity || 0} {av.unit || m.unit || "Nos"}
                            </b>
                            <span>{av.availableSize || "-"}</span>
                            <small>{av.remark || "-"}</small>
                          </>
                        ) : (
                          <span className="not-updated">Not updated</span>
                        )}

                        {check?.audioAttachment?.filePath && (
                          <button
                            type="button"
                            className="audio-view-btn"
                            onClick={() => openAudioPopup(check.audioAttachment.filePath)}
                          >
                            🎤 Audio
                          </button>
                        )}
                      </td>

                      {index === 0 && (
                        <td rowSpan={materials.length} className="source-col">
                          {enq.source || "-"}
                        </td>
                      )}

                      <td className="action-col">
                        <button
                          className="line-update-btn"
                          onClick={() => openUpdateModal({ enq, material: m, index })}
                        >
                          <Mic size={14} />
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                });
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
              <span>{formatMake(enq.makeOrigin || enq.customerType)}</span>
              <span>{enq.source || "-"}</span>
            </div>

            <div className="mobile-material-grid">
              {(enq.materials || []).map((m, index) => {
                const check = getMaterialCheck(enq, index);
                const av = check?.availability || {};
                const updateStatus = av.status || check?.status || "pending";

                return (
                  <div key={index}>
                    <b>{m.grade || "-"}</b>
                    <span>{formatShape(m.shape)}</span>
                    <p>{m.size || "-"}</p>
                    <strong>
                      {m.quantity || 0} {m.unit || "Nos"}
                    </strong>

                    <section>
                      <em>{getStatusLabel(updateStatus)}</em>

                      {av.status && av.status !== "pending" ? (
                        <small>
                          {av.availableQuantity || 0} {av.unit || "Nos"} ·{" "}
                          {av.availableSize || "-"}
                        </small>
                      ) : (
                        <small>Not updated</small>
                      )}

                      {check?.audioAttachment?.filePath && (
                        <button
                          type="button"
                          className="mobile-audio-view-btn"
                          onClick={() => openAudioPopup(check.audioAttachment.filePath)}
                        >
                          🎤 Audio
                        </button>
                      )}
                    </section>

                    <button
                      className="mobile-update-line-btn"
                      onClick={() => openUpdateModal({ enq, material: m, index })}
                    >
                      Update Availability
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="enq-pagination">
        <button
          disabled={pagination.page <= 1}
          onClick={() => fetchEnquiries(pagination.page - 1)}
        >
          <ChevronLeft size={15} /> Prev
        </button>

        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>

        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => fetchEnquiries(pagination.page + 1)}
        >
          Next <ChevronRight size={15} />
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

      {updateItem && (
        <UpdateMaterialModal
          item={updateItem}
          onClose={() => setUpdateItem(null)}
          onUpdated={() => {
            setUpdateItem(null);
            fetchEnquiries(pagination.page);
          }}
        />
      )}

      {selectedAudio && (
        <div className="audio-modal-overlay" onClick={closeAudioPopup}>
          <div className="audio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="audio-modal-head">
              <h3>Voice Update</h3>

              <button type="button" onClick={closeAudioPopup}>
                <X size={18} />
              </button>
            </div>

            <div className="voice-player-card">
              <button type="button" className="voice-play-btn" onClick={toggleAudio}>
                {audioPlaying ? <Pause size={20} /> : <Play size={20} />}
                {audioPlaying ? "Pause Voice Note" : "Play Voice Note"}
              </button>

              <audio
                ref={audioRef}
                src={selectedAudio.url}
                preload="auto"
                onEnded={() => setAudioPlaying(false)}
                onError={() => {
                  setAudioError("Unable to play audio inside popup.");
                  setAudioPlaying(false);
                }}
              />

              {audioError && <p className="voice-error">{audioError}</p>}

              <a
                className="audio-open-link"
                href={selectedAudio.url}
                target="_blank"
                rel="noreferrer"
              >
                Open Audio
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnquiryListPage;