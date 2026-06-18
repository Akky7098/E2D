import { useRef, useState } from "react";
import { Mic, Save, Square, Trash2, X } from "lucide-react";
import "./UpdateMaterialModal.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function UpdateMaterialModal({ item, onClose, onUpdated }) {
  const oldAvailability = item?.materialCheck?.availability || {};
  const savedAudioPath = item?.materialCheck?.audioAttachment?.filePath || "";

  const [availabilityStatus, setAvailabilityStatus] = useState(
    oldAvailability.status && oldAvailability.status !== "pending"
      ? oldAvailability.status
      : "exact_available"
  );

  const [availableSize, setAvailableSize] = useState(
    oldAvailability.availableSize || item?.material?.size || ""
  );

  const [availableQuantity, setAvailableQuantity] = useState(
    oldAvailability.availableQuantity || item?.material?.quantity || ""
  );

  const [remark, setRemark] = useState(oldAvailability.remark || "");

  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const closeModal = () => {
    try {
      if (recording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      // ignore recorder close error
    }

    stopTimer();
    stopStream();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    onClose();
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioBlob(null);
      setAudioUrl("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);
        }

        setRecording(false);
        stopTimer();
        stopStream();
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);

      stopTimer();
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (error) {
      setRecording(false);
      stopTimer();
      stopStream();
      alert("Microphone permission denied or not available.");
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && recording) {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      setRecording(false);
      stopTimer();
      stopStream();
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl("");
    setRecordSeconds(0);
  };

  const formatSeconds = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const submitUpdate = async (e) => {
    e.preventDefault();

    if (!item?.materialCheckId) {
      alert("Material check ID missing.");
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");
      const formData = new FormData();

      formData.append("availabilityStatus", availabilityStatus);
      formData.append("availableSize", availableSize || "");
      formData.append("availableQuantity", availableQuantity || 0);
      formData.append("remark", remark || "");

      if (audioBlob) {
        const audioFile = new File(
          [audioBlob],
          `shed-audio-${Date.now()}.webm`,
          { type: "audio/webm" }
        );

        formData.append("audioFile", audioFile);
      }

      const response = await fetch(
        `${BASE_URL}/api/material-checks/${item.materialCheckId}/update`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Update failed");
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      onUpdated();
    } catch (error) {
      alert(error.message || "Unable to update material");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="update-modal-overlay">
      <div className="update-modal">
        <div className="update-modal-head">
          <div>
            <span>Material Availability</span>
            <h2>Update Stock Status</h2>
            <p>
              {item?.enquiry?.enquiryNo} · Line {item?.lineNo}
            </p>
          </div>

          <button type="button" onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        <div className="update-material-summary">
          <div>
            <label>Grade</label>
            <strong>{item?.material?.grade || "-"}</strong>
          </div>

          <div>
            <label>Requested Size</label>
            <strong>{item?.material?.size || "-"}</strong>
          </div>

          <div>
            <label>Requested Qty</label>
            <strong>
              {item?.material?.quantity || 0} {item?.material?.unit || "Nos"}
            </strong>
          </div>
        </div>

        <form onSubmit={submitUpdate} className="update-form">
          <div className="update-left-panel">
            <div className="update-field">
              <label>Status</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
              >
                <option value="exact_available">Exact Available</option>
                <option value="near_available">Near Size Available</option>
                <option value="partial_available">Partial Available</option>
                <option value="not_available">Not Available</option>
                <option value="unclear">Unclear / Need Review</option>
              </select>
            </div>

            <div className="update-grid">
              <div className="update-field">
                <label>Available Size</label>
                <input
                  value={availableSize}
                  onChange={(e) => setAvailableSize(e.target.value)}
                  placeholder="dia 120 or 200x100x500"
                />
              </div>

              <div className="update-field">
                <label>Available Qty</label>
                <input
                  type="number"
                  min="0"
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="update-field">
              <label>Remark</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Example: 2 pcs available in shed, balance not available..."
                rows={4}
              />
            </div>
          </div>

          <div className="record-card">
            <div>
              <h4>Voice Remark</h4>
              <p>Click record, speak, stop, then save update.</p>
            </div>

            <div className={`record-circle ${recording ? "recording" : ""}`}>
              <Mic size={24} />
              <span>{formatSeconds(recordSeconds)}</span>
            </div>

            <div className="record-actions">
              {!recording ? (
                <button type="button" onClick={startRecording}>
                  <Mic size={16} />
                  Record Audio
                </button>
              ) : (
                <button
                  type="button"
                  className="stop-record"
                  onClick={stopRecording}
                >
                  <Square size={16} />
                  Stop
                </button>
              )}

              {audioUrl && (
                <button
                  type="button"
                  className="delete-record"
                  onClick={deleteRecording}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>

            {!audioUrl && savedAudioPath && (
              <div className="audio-preview">
                <audio controls src={`${BASE_URL}${savedAudioPath}`} />
              </div>
            )}

            {audioUrl && (
              <div className="audio-preview">
                <audio controls src={audioUrl} />
              </div>
            )}
          </div>

          <div className="update-actions">
            <button
              type="button"
              className="cancel-update"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="save-update"
              disabled={saving || recording}
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateMaterialModal;