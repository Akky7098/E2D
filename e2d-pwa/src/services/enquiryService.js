import api from "./api";

export const createManualEnquiry = async (data) => {
  const response = await api.post("/enquiries", data);
  return response.data;
};

export const getEnquiries = async (params = {}) => {
  const response = await api.get("/enquiries", { params });
  return response.data;
};

export const getEnquiryById = async (id) => {
  const response = await api.get(`/enquiries/${id}`);
  return response.data;
};
export const getProductGrades = async () => {
  const response = await api.get("/enquiries/grades");
  return response.data;
};

export const getActiveSheds = async () => {
  const response = await api.get("/enquiries/sheds");
  return response.data;
};