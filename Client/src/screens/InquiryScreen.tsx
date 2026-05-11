import React, { useMemo, useState } from "react";
import { ActionButton, Card, Shell } from "../components/ui";
import { getApiBaseUrl } from "../utils/api";

const purple = "#4B257A";
const green = "#7BC043";

const productOptions = [
  "Coroplast",
  "Decals",
  "Printed Decals",
  "Artwork",
  "Banner",
  "DTF Film",
  "Printed HTV",
  "Embroidery",
  "Printed Banner",
  "Screen Printing",
  "Business Cards",
  "Promo",
  "Other",
];

export default function InquiryScreen({
  setScreen,
  apiBaseUrl,
  currentUser,
  deviceName,
}: any) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    productTypes: [] as string[],
    otherProductType: "",
    inquiry: "",
  });

  const [submitState, setSubmitState] = useState({
    loading: false,
    success: false,
    message: "",
  });

  const canSubmit = useMemo(() => {
    return (
      String(form.name || "").trim() &&
      String(form.email || "").trim() &&
      String(form.phone || "").trim() &&
      String(form.inquiry || "").trim()
    );
  }, [form]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleProductType = (option: string) => {
    setForm((prev) => {
      const alreadySelected = prev.productTypes.includes(option);

      return {
        ...prev,
        productTypes: alreadySelected
          ? prev.productTypes.filter((item) => item !== option)
          : [...prev.productTypes, option],
      };
    });
  };

  const buildInquiryBody = () => {
    const selectedProductTypes = (form.productTypes || []).map((type) => {
      if (type === "Other") {
        return String(form.otherProductType || "").trim() || "Other";
      }
      return type;
    });

    const lines = [
      selectedProductTypes.length
        ? `Product Type: ${selectedProductTypes.join(", ")}`
        : "",
      form.company ? `Company: ${form.company}` : "",
      currentUser ? `Rep: ${currentUser}` : "",
      deviceName ? `Device: ${deviceName}` : "",
      "",
      String(form.inquiry || "").trim(),
    ].filter(Boolean);

    return lines.join("\n");
  };

  const resetForm = () => {
    setForm({
      name: "",
      company: "",
      email: "",
      phone: "",
      productTypes: [],
      otherProductType: "",
      inquiry: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      setSubmitState({
        loading: false,
        success: false,
        message: "Please fill in name, email, phone, and inquiry details.",
      });
      return;
    }

    setSubmitState({
      loading: true,
      success: false,
      message: "Sending inquiry to Printavo...",
    });

    try {
      const response = await fetch(
        `${getApiBaseUrl(apiBaseUrl)}/api/printavo/inquiry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            inquiry: buildInquiryBody(),
          }),
        }
      );

      const rawText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText || "Unexpected server response.");
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Inquiry submission failed.");
      }

      setSubmitState({
        loading: false,
        success: true,
        message: data?.message || "Inquiry submitted to Printavo.",
      });
    } catch (error: any) {
      setSubmitState({
        loading: false,
        success: false,
        message: error?.message || "Inquiry submission failed.",
      });
    }
  };

  return (
    <Shell
      title="Inquiry Intake"
      subtitle="Quick customer intake sent straight to Printavo inquiries"
    >
      <div className="space-y-6">
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-black text-slate-900">
                New Inquiry
              </div>
              <div className="mt-1 text-slate-600">
                Fast lead capture without building a full order.
              </div>
            </div>

            <div
              className="rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: purple }}
            >
              Decal Monkey Inquiry
            </div>
          </div>
        </Card>

        {submitState.success ? (
          <Card className="p-6">
            <div className="space-y-4">
              <div
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: green }}
              >
                Inquiry Sent
              </div>

              <div className="text-3xl font-black text-slate-900">
                Inquiry delivered to Printavo.
              </div>

              <div className="text-slate-600 leading-7">
                CSR can now pick this up directly inside Printavo inquiries
                without the rep having to build a full order first.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700 whitespace-pre-line">
                {submitState.message}
              </div>

              <div className="flex gap-3 flex-wrap pt-2">
                <ActionButton
                  onClick={() => {
                    resetForm();
                    setSubmitState({
                      loading: false,
                      success: false,
                      message: "",
                    });
                  }}
                >
                  Send Another
                </ActionButton>

                <ActionButton
                  variant="secondary"
                  onClick={() => setScreen("home")}
                >
                  Back to Home
                </ActionButton>
              </div>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-5 md:p-6 space-y-5">
              <div className="text-xl font-bold text-slate-800">
                Customer Details
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 font-semibold text-slate-800">Name *</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <div className="mb-2 font-semibold text-slate-800">Company</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800"
                    value={form.company}
                    onChange={(e) => updateField("company", e.target.value)}
                    placeholder="Company name"
                  />
                </div>

                <div>
                  <div className="mb-2 font-semibold text-slate-800">Email *</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="customer@email.com"
                    type="email"
                  />
                </div>

                <div>
                  <div className="mb-2 font-semibold text-slate-800">Phone *</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="Customer phone"
                    type="tel"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5 md:p-6 space-y-5">
              <div className="text-xl font-bold text-slate-800">
                What are we making?
              </div>

              <div className="text-sm text-slate-500">
                Select all that apply.
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {productOptions.map((option) => {
                  const active = form.productTypes.includes(option);
                  return (
                    <div key={option} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleProductType(option)}
                        className="w-full rounded-2xl border p-3 text-left transition"
                        style={{
                          borderColor: active ? purple : "#CBD5E1",
                          background: active ? "#F4EEFB" : "white",
                          boxShadow: active ? "0 6px 16px rgba(75,37,122,0.12)" : "none",
                        }}
                      >
                        <div className="font-semibold text-slate-800">{option}</div>
                      </button>

                      {option === "Other" &&
                      form.productTypes.includes("Other") ? (
                        <input
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800"
                          value={form.otherProductType}
                          onChange={(e) => updateField("otherProductType", e.target.value)}
                          placeholder="Type the product name"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5 md:p-6 space-y-5">
              <div className="text-xl font-bold text-slate-800">
                Inquiry Details
              </div>

              <div>
                <div className="mb-2 font-semibold text-slate-800">
                  How can we help? *
                </div>
                <textarea
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-800 min-h-[170px]"
                  value={form.inquiry}
                  onChange={(e) => updateField("inquiry", e.target.value)}
                  placeholder="Describe what the customer needs, any timing, sizes, artwork status, or other helpful notes."
                />
              </div>

              {submitState.message ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  {submitState.message}
                </div>
              ) : null}

              <div className="flex gap-3 flex-wrap pt-2">
                <ActionButton
                  type="submit"
                  className="min-w-[220px]"
                  disabled={submitState.loading}
                >
                  {submitState.loading ? "Sending Inquiry..." : "Submit Inquiry"}
                </ActionButton>

                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setScreen("home")}
                >
                  Back to Home
                </ActionButton>
              </div>
            </Card>
          </form>
        )}
      </div>
    </Shell>
  );
}
