import { useEffect, useMemo, useRef, useState } from "react";
import { Card, ActionButton, Tile, Shell } from "../components/ui";

const PRINTAVO_CATEGORIES = [
  "Coroplast Sign",
  "Decals",
  "Magnet",
  "Poster",
  "Printed Banner",
  "Printed Decals",
  "Printed Magnets",
  "Promo",
  "Other",
] as const;

const FINISH_OPTIONS = ["Matte", "Gloss", "None"] as const;
const MOCKUP_PLACEHOLDER = "Tell the graphic designer exactly what needs to happen with the customer artwork for this job.";
const MEASUREMENT_UNITS = [
  { value: "in", label: "Inch" },
  { value: "ft", label: "Feet" },
] as const;

function getApiBaseUrl() {
  try {
    return String(localStorage.getItem("dm_api_base_url") || "http://localhost:3001").trim().replace(/\/+$/, "");
  } catch {
    return "http://localhost:3001";
  }
}

type WizardProps = {
  steps: string[];
  step: number;
  totalSteps: number;
  form: any;
  updateField: (key: string, value: any) => void;
  addPhotoEntry: () => void;
  updatePhotoEntry: (entryId: number, key: string, value: any) => void;
  movePhotoEntry: (entryId: number, direction: number) => void;
  deletePhotoEntry: (entryId: number) => void;
  saveDraftNow: () => boolean | void;
  setStep: (value: any) => void;
  setScreen: (value: string) => void;
  submitOrder: (options?: { goHomeAfterSave?: boolean }) => void;
  submitState: { loading: boolean; message: string };
  editingSubmittedOrder: any;
  exitWizardToHome?: () => void;
  addProductionFiles?: (files: any[]) => void;
  removeProductionFile?: (fileId: string | number) => void;
  updateLineItem?: (index: number, key: string, value: any) => void;
  hasUnsavedChanges?: boolean;
};

function makeLineItem(category: string) {
  return {
    id: `line-item-${category.toLowerCase().replace(/\s+/g, "-")}`,
    category,
    color: "",
    description: "",
    quantity: "1",
    finish: "",
    otherDetails: "",
  };
}

function getLineItemForCategory(form: any, category: string) {
  return (
    (form.lineItems || []).find((item: any) => item.category === category) ||
    null
  );
}

function formatDimension(value: any, unit: any) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "";
  const suffix = unit === "ft" ? "ft" : "in";
  return `${cleanValue} ${suffix}`;
}

export default function WizardScreen({
  steps,
  step,
  totalSteps,
  form,
  updateField,
  addPhotoEntry,
  updatePhotoEntry,
  movePhotoEntry,
  deletePhotoEntry,
  saveDraftNow,
  setStep,
  setScreen,
  submitOrder,
  submitState,
  editingSubmittedOrder,
  exitWizardToHome,
  addProductionFiles,
  removeProductionFile,
  updateLineItem,
  hasUnsavedChanges = true,
}: WizardProps) {
  const [markupOpen, setMarkupOpen] = useState(false);
  const [activeMarkupEntryId, setActiveMarkupEntryId] = useState<number | null>(
    null
  );
  const [tool, setTool] = useState("pen");
  const [textNote, setTextNote] = useState("");
  const [shapeColor, setShapeColor] = useState("#ef4444");
  const [shapes, setShapes] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(
    null
  );
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [goHomeModalOpen, setGoHomeModalOpen] = useState(false);
  const [saveDraftToast, setSaveDraftToast] = useState("");
  const [remoteEditDetails, setRemoteEditDetails] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: null | (() => void);
    cancelLabel?: string;
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    onConfirm: null,
    cancelLabel: "Cancel",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const activeEntry =
    (form.photoEntries || []).find(
      (entry: any) => entry.id === activeMarkupEntryId
    ) || null;

  const showArtFeeMessage =
    form.logoStatus === "Needs design" ||
    form.logoStatus === "Recreate / Vectorize";

  const artFeeMessage =
    form.logoStatus === "Recreate / Vectorize"
      ? "Let the customer know artwork recreation/vectorizing is quoted at $50/hr with a $25 minimum."
      : "Let the customer know that design time is quoted at $50/hr with a $25 minimum.";

  const installFeeMessage =
    "Let the customer know installation fees are included in the quote and are based on travel, job size, and site conditions.";

  const artworkInstructionPrompts: Record<string, string> = {
    "Customer provided":
      "Tell the graphic designer what should happen with the customer-supplied artwork once it comes in. Include placement, sizing, cleanup, proof needs, and anything special to watch for.",
    "Needs design":
      "Tell the graphic designer what needs to be designed from scratch. Include wording, layout ideas, sizing, placement, and the overall look or style the customer wants.",
    "Recreate / Vectorize":
      "Tell the graphic designer what needs to be recreated or vectorized. Include what art the customer has, what it needs to match, and anything that should be cleaned up, redrawn, or separated.",
  };

  const artworkInstructionLabelMap: Record<string, string> = {
    "Customer provided": "Instructions for customer artwork",
    "Needs design": "Instructions for new design work",
    "Recreate / Vectorize": "Instructions for recreate / vectorize work",
  };

  const currentArtworkPrompt =
    artworkInstructionPrompts[form.logoStatus || "Customer provided"] ||
    MOCKUP_PLACEHOLDER;

  const currentArtworkLabel =
    artworkInstructionLabelMap[form.logoStatus || "Customer provided"] ||
    "Artwork instructions";

  const replaceInputIds = useMemo(() => {
    const map: Record<number, string> = {};
    (form.photoEntries || []).forEach((entry: any) => {
      map[entry.id] = `replace-photo-${entry.id}`;
    });
    return map;
  }, [form.photoEntries]);

  const editModeArtworkLineItems = useMemo(() => {
    if (!editingSubmittedOrder) return [];
    const safeLineItems = Array.isArray(remoteEditDetails?.lineItems)
      ? remoteEditDetails.lineItems
      : Array.isArray(form?.lineItems)
      ? form.lineItems
      : [];
    return safeLineItems
      .map((item: any, index: number) => ({
        id: item?.id || `wizard-workorder-line-${index + 1}`,
        heading: item?.category || `Line Item ${item?.itemNumber || index + 1}`,
        itemNumber: item?.itemNumber || String(index + 1),
        quantity: item?.quantity || "",
        color: item?.color || "",
        description: item?.description || "",
        finish: item?.finish || "",
        otherDetails: item?.otherDetails || "",
        sizeLabel: item?.sizeLabel || "",
        imageUrl: item?.imageUrl || "",
      }))
      .filter(
        (item: any) =>
          item.imageUrl ||
          item.description ||
          item.otherDetails ||
          item.color ||
          item.finish
      );
  }, [editingSubmittedOrder, form?.lineItems]);

  const editModeArtworkReferenceImages = useMemo<string[]>(() => {
    if (!editingSubmittedOrder) return [];
    const raw = Array.isArray(remoteEditDetails?.artworkReferenceImages)
      ? (remoteEditDetails.artworkReferenceImages as any[])
      : Array.isArray(editingSubmittedOrder?.artworkReferenceImages)
      ? (editingSubmittedOrder.artworkReferenceImages as any[])
      : [];
    return Array.from(
      new Set(raw.map((value: any) => String(value || "").trim()).filter(Boolean))
    );
  }, [editingSubmittedOrder]);

  useEffect(() => {
    let cancelled = false;

    const loadEditDetails = async () => {
      if (!editingSubmittedOrder?.printavoQuoteId) {
        setRemoteEditDetails(null);
        return;
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/printavo/measurement-job-details/${editingSubmittedOrder.printavoQuoteId}`
        );
        const data = await response.json();
        if (!response.ok || !data?.ok) return;
        if (!cancelled) {
          setRemoteEditDetails(data.job || null);
        }
      } catch {
        if (!cancelled) {
          setRemoteEditDetails(null);
        }
      }
    };

    loadEditDetails();
    return () => {
      cancelled = true;
    };
  }, [editingSubmittedOrder?.printavoQuoteId]);

  const openConfirmModal = ({
    title,
    message,
    confirmLabel,
    onConfirm,
    cancelLabel,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    cancelLabel?: string;
  }) => {
    setConfirmModal({
      open: true,
      title,
      message,
      confirmLabel: confirmLabel || "Confirm",
      onConfirm,
      cancelLabel: cancelLabel || "Cancel",
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      open: false,
      title: "",
      message: "",
      confirmLabel: "Confirm",
      onConfirm: null,
      cancelLabel: "Cancel",
    });
  };

  const goHomeNow = () => {
    if (typeof exitWizardToHome === "function") {
      exitWizardToHome();
      return;
    }
    setStep(1);
    setScreen("home");
  };

  const goToStep = (targetStep: number) => {
    setStep(targetStep);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSaveDraft = (message: string = "Draft saved") => {
    const didSave = saveDraftNow();
    if (didSave === false) {
      return;
    }
    setSaveDraftToast(message);
    if (typeof window !== "undefined") {
      window.clearTimeout((window as any).__dmDraftToastTimer);
      (window as any).__dmDraftToastTimer = window.setTimeout(
        () => setSaveDraftToast(""),
        2200
      );
    } else {
      setTimeout(() => setSaveDraftToast(""), 2200);
    }
  };

  const handleBack = () => {
    if (step <= 1) {
      goHomeNow();
      return;
    }
    goToStep(Math.max(1, step - 1));
  };

  const handleGoHomeWithoutSaving = () => {
    setGoHomeModalOpen(false);
    goHomeNow();
  };

  const handleSaveAndGoHome = () => {
    if (editingSubmittedOrder) {
      if (!hasUnsavedChanges) {
        setGoHomeModalOpen(false);
        goHomeNow();
        return;
      }

      setGoHomeModalOpen(false);
      submitOrder({ goHomeAfterSave: true });
      return;
    }

    const didSave = saveDraftNow();
    if (didSave === false) {
      setGoHomeModalOpen(false);
      goHomeNow();
      return;
    }

    setSaveDraftToast("Draft saved. Returning home...");
    setGoHomeModalOpen(false);

    if (typeof window !== "undefined") {
      window.clearTimeout((window as any).__dmDraftToastTimer);
      (window as any).__dmDraftToastTimer = window.setTimeout(
        () => setSaveDraftToast(""),
        2200
      );
      window.clearTimeout((window as any).__dmGoHomeTimer);
      (window as any).__dmGoHomeTimer = window.setTimeout(
        () => goHomeNow(),
        900
      );
    } else {
      setTimeout(() => setSaveDraftToast(""), 2200);
      setTimeout(() => goHomeNow(), 900);
    }
  };

  const syncLineItems = (nextProductTypes: string[]) => {
    const existing = Array.isArray(form.lineItems) ? form.lineItems : [];
    const retained = existing.filter((item: any) =>
      nextProductTypes.includes(item.category)
    );
    const missing = nextProductTypes
      .filter(
        (category) => !retained.some((item: any) => item.category === category)
      )
      .map((category) => makeLineItem(category));

    updateField("lineItems", [...retained, ...missing]);
  };

  const handleToggleCategory = (category: string) => {
    const current = Array.isArray(form.productTypes) ? form.productTypes : [];
    const next = current.includes(category)
      ? current.filter((item: string) => item !== category)
      : [...current, category];

    updateField("productTypes", next);
    syncLineItems(next);
  };

  const handleLineItemChange = (
    category: string,
    key: string,
    value: string
  ) => {
    const items = Array.isArray(form.lineItems) ? [...form.lineItems] : [];
    const index = items.findIndex((item: any) => item.category === category);

    if (index === -1) {
      const newItem = { ...makeLineItem(category), [key]: value };
      updateField("lineItems", [...items, newItem]);
      return;
    }

    if (typeof updateLineItem === "function") {
      updateLineItem(index, key, value);
      return;
    }

    items[index] = { ...items[index], [key]: value };
    updateField("lineItems", items);
  };

  const handleProductionFilesUpload = (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `${Date.now()}-${Math.random()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                fileData: reader.result,
              });
            reader.readAsDataURL(file);
          })
      )
    ).then((processedFiles: any[]) => {
      if (typeof addProductionFiles === "function") {
        addProductionFiles(processedFiles);
        return;
      }

      updateField("productionFiles", [
        ...(form.productionFiles || []),
        ...processedFiles,
      ]);
    });
  };

  const handleRemoveProductionFile = (fileId: string | number) => {
    if (typeof removeProductionFile === "function") {
      removeProductionFile(fileId);
      return;
    }
    updateField(
      "productionFiles",
      (form.productionFiles || []).filter((file: any) => file.id !== fileId)
    );
  };

  const handlePhotoUpload = (entryId: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updatePhotoEntry(entryId, "imageData", reader.result);
      updatePhotoEntry(entryId, "annotatedImageData", "");
    };
    reader.readAsDataURL(file);
  };

  const replacePhotoUpload = (entryId: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updatePhotoEntry(entryId, "imageData", reader.result);
      updatePhotoEntry(entryId, "annotatedImageData", "");
    };
    reader.readAsDataURL(file);
  };

  const confirmDeletePhoto = (entryId: number) => {
    openConfirmModal({
      title: "Delete Photo?",
      message:
        "This will remove the image, measurements, notes, and details on this photo card.",
      confirmLabel: "Delete Photo",
      onConfirm: () => {
        deletePhotoEntry(entryId);
        closeConfirmModal();
      },
    });
  };

  const renderPhotoPreview = (entry: any, index: number) => {
    const previewSrc = entry.annotatedImageData || entry.imageData;
    if (previewSrc) {
      return (
        <img decoding="async" loading="lazy"
          src={previewSrc}
          alt={entry.name || `Photo ${index + 1}`}
          className="w-full h-56 object-cover"
        />
      );
    }

    return (
      <div className="h-56 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-500">
        Photo Placeholder
      </div>
    );
  };

  const openMarkupEditor = (entry: any) => {
    if (!entry.imageData) {
      openConfirmModal({
        title: "Upload Required",
        message: "Please upload a photo before opening markup.",
        confirmLabel: "OK",
        cancelLabel: "",
        onConfirm: closeConfirmModal,
      });
      return;
    }
    setActiveMarkupEntryId(entry.id);
    setTool("pen");
    setTextNote("");
    setShapeColor("#ef4444");
    setShapes([]);
    setSelectedShapeIndex(null);
    setResizeHandle(null);
    setMarkupOpen(true);
  };

  const closeMarkupEditor = () => {
    setMarkupOpen(false);
    setActiveMarkupEntryId(null);
    setShapes([]);
    setTextNote("");
    setIsDrawing(false);
    setStartPoint(null);
    setSelectedShapeIndex(null);
    setResizeHandle(null);
  };

  const getCanvasPoint = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const distanceBetweenPoints = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  const distanceToSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return distanceBetweenPoints(px, py, x1, y1);
    }

    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );

    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    return distanceBetweenPoints(px, py, nearestX, nearestY);
  };

  const getTextMetrics = (shape: any) => {
    const scale = shape.scale || 1;
    const fontSize = 18 * scale;
    const width = Math.max(
      (shape.text || "").length * fontSize * 0.58,
      60 * scale
    );
    const height = fontSize + 14;
    return { fontSize, width, height };
  };

  const getShapeBounds = (shape: any) => {
    if (shape.type === "text") {
      const { fontSize, width, height } = getTextMetrics(shape);
      return {
        left: shape.x - 8,
        top: shape.y - fontSize,
        width: width + 16,
        height,
      };
    }

    if (shape.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) +
          Math.pow(shape.endY - shape.startY, 2)
      );
      return {
        left: shape.startX - radius,
        top: shape.startY - radius,
        width: radius * 2,
        height: radius * 2,
      };
    }

    if (shape.type === "arrow") {
      const left = Math.min(shape.startX, shape.endX);
      const top = Math.min(shape.startY, shape.endY);
      const right = Math.max(shape.startX, shape.endX);
      const bottom = Math.max(shape.startY, shape.endY);
      return {
        left: left - 10,
        top: top - 10,
        width: right - left + 20,
        height: bottom - top + 20,
      };
    }

    if (shape.type === "pen" && shape.points?.length) {
      const xs = shape.points.map((p: any) => p.x);
      const ys = shape.points.map((p: any) => p.y);
      return {
        left: Math.min(...xs) - 10,
        top: Math.min(...ys) - 10,
        width: Math.max(...xs) - Math.min(...xs) + 20,
        height: Math.max(...ys) - Math.min(...ys) + 20,
      };
    }

    return null;
  };

  const getResizeHandleAtPoint = (
    shape: any,
    point: { x: number; y: number }
  ) => {
    if (shape.type !== "text") return null;
    const bounds = getShapeBounds(shape);
    if (!bounds) return null;

    const handles = [
      { name: "nw", x: bounds.left, y: bounds.top },
      { name: "ne", x: bounds.left + bounds.width, y: bounds.top },
      { name: "sw", x: bounds.left, y: bounds.top + bounds.height },
      {
        name: "se",
        x: bounds.left + bounds.width,
        y: bounds.top + bounds.height,
      },
    ];

    for (const handle of handles) {
      if (distanceBetweenPoints(point.x, point.y, handle.x, handle.y) <= 18) {
        return handle.name;
      }
    }

    return null;
  };

  const hitTestShape = (shape: any, point: { x: number; y: number }) => {
    const tolerance = 18;

    if (shape.type === "text") {
      const bounds = getShapeBounds(shape);
      if (!bounds) return false;
      return (
        point.x >= bounds.left &&
        point.x <= bounds.left + bounds.width &&
        point.y >= bounds.top &&
        point.y <= bounds.top + bounds.height
      );
    }

    if (shape.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) +
          Math.pow(shape.endY - shape.startY, 2)
      );
      const distance = distanceBetweenPoints(
        point.x,
        point.y,
        shape.startX,
        shape.startY
      );
      return Math.abs(distance - radius) <= tolerance;
    }

    if (shape.type === "arrow") {
      return (
        distanceToSegment(
          point.x,
          point.y,
          shape.startX,
          shape.startY,
          shape.endX,
          shape.endY
        ) <= tolerance
      );
    }

    if (shape.type === "pen") {
      if (!shape.points || shape.points.length < 2) return false;
      for (let i = 0; i < shape.points.length - 1; i += 1) {
        const a = shape.points[i];
        const b = shape.points[i + 1];
        if (
          distanceToSegment(point.x, point.y, a.x, a.y, b.x, b.y) <= tolerance
        ) {
          return true;
        }
      }
    }

    return false;
  };

  const getShapeIndexAtPoint = (point: { x: number; y: number }) => {
    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      if (hitTestShape(shapes[i], point)) return i;
    }
    return -1;
  };

  const moveShapeByDelta = (shape: any, dx: number, dy: number) => {
    if (shape.type === "text") {
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    }
    if (shape.type === "circle" || shape.type === "arrow") {
      return {
        ...shape,
        startX: shape.startX + dx,
        startY: shape.startY + dy,
        endX: shape.endX + dx,
        endY: shape.endY + dy,
      };
    }
    if (shape.type === "pen") {
      return {
        ...shape,
        points: shape.points.map((point: any) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    }
    return shape;
  };

  const resizeTextShape = (
    shape: any,
    handle: string,
    point: { x: number; y: number }
  ) => {
    const bounds = getShapeBounds(shape);
    if (!bounds) return shape;

    let newLeft = bounds.left;
    let newTop = bounds.top;
    let newRight = bounds.left + bounds.width;
    let newBottom = bounds.top + bounds.height;

    if (handle.includes("n")) newTop = point.y;
    if (handle.includes("s")) newBottom = point.y;
    if (handle.includes("w")) newLeft = point.x;
    if (handle.includes("e")) newRight = point.x;

    const newWidth = Math.max(50, newRight - newLeft);
    const newHeight = Math.max(28, newBottom - newTop);

    const baseWidth = Math.max((shape.text || "").length * 18 * 0.58, 60);
    const baseHeight = 18 + 14;

    const widthScale = newWidth / (baseWidth + 16);
    const heightScale = newHeight / baseHeight;
    const scale = Math.max(0.5, Math.min(6, (widthScale + heightScale) / 2));

    const fontSize = 18 * scale;

    return { ...shape, scale, x: newLeft + 8, y: newTop + fontSize };
  };

  const drawSelectionOutline = (ctx: CanvasRenderingContext2D, shape: any) => {
    const bounds = getShapeBounds(shape);
    if (!bounds) return;

    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.setLineDash([]);

    const handleSize = 8;
    const handles = [
      [bounds.left, bounds.top],
      [bounds.left + bounds.width, bounds.top],
      [bounds.left, bounds.top + bounds.height],
      [bounds.left + bounds.width, bounds.top + bounds.height],
    ];

    ctx.fillStyle = "#2563eb";
    handles.forEach(([x, y]) => {
      ctx.fillRect(
        x - handleSize / 2,
        y - handleSize / 2,
        handleSize,
        handleSize
      );
    });
    ctx.restore();
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    shapes.forEach((shape, index) => {
      const isSelected = index === selectedShapeIndex;
      const color = shape.color || "#ef4444";

      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      if (shape.type === "pen") {
        ctx.beginPath();
        shape.points.forEach((point: any, pointIndex: number) => {
          if (pointIndex === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }

      if (shape.type === "circle") {
        const radius = Math.sqrt(
          Math.pow(shape.endX - shape.startX, 2) +
            Math.pow(shape.endY - shape.startY, 2)
        );
        ctx.beginPath();
        ctx.arc(shape.startX, shape.startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (shape.type === "arrow") {
        const headLength = 14;
        const angle = Math.atan2(
          shape.endY - shape.startY,
          shape.endX - shape.startX
        );

        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - headLength * Math.cos(angle - Math.PI / 6),
          shape.endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          shape.endX - headLength * Math.cos(angle + Math.PI / 6),
          shape.endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.lineTo(shape.endX, shape.endY);
        ctx.fill();
      }

      if (shape.type === "text") {
        const fontSize = 18 * (shape.scale || 1);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(shape.text, shape.x, shape.y);
      }

      if (isSelected) drawSelectionOutline(ctx, shape);
    });
  };

  useEffect(() => {
    if (!markupOpen || !activeEntry?.imageData) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      redrawCanvas();
    };
    img.src = activeEntry.imageData;
  }, [markupOpen, activeEntry?.imageData]);

  useEffect(() => {
    if (markupOpen) redrawCanvas();
  }, [shapes, markupOpen, selectedShapeIndex]);

  const startDraw = (e: any) => {
    if (!markupOpen) return;
    const point = getCanvasPoint(e);

    if (tool === "move") {
      if (
        selectedShapeIndex !== null &&
        shapes[selectedShapeIndex]?.type === "text"
      ) {
        const handle = getResizeHandleAtPoint(
          shapes[selectedShapeIndex],
          point
        );
        if (handle) {
          setResizeHandle(handle);
          setStartPoint(point);
          setIsDrawing(true);
          return;
        }
      }

      const shapeIndex = getShapeIndexAtPoint(point);
      if (shapeIndex !== -1) {
        setSelectedShapeIndex(shapeIndex);
        setStartPoint(point);
        setResizeHandle(null);
        setIsDrawing(true);
      } else {
        setSelectedShapeIndex(null);
        setIsDrawing(false);
        setStartPoint(null);
        setResizeHandle(null);
      }
      return;
    }

    if (tool === "text") {
      if (!textNote.trim()) {
        openConfirmModal({
          title: "Text Required",
          message: "Enter text first before placing a note.",
          confirmLabel: "OK",
          cancelLabel: "",
          onConfirm: closeConfirmModal,
        });
        return;
      }
      setShapes((prev) => {
        const next = [
          ...prev,
          {
            type: "text",
            x: point.x,
            y: point.y,
            text: textNote,
            color: shapeColor,
            scale: 1,
          },
        ];
        setSelectedShapeIndex(next.length - 1);
        return next;
      });
      setTextNote("");
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);
    setSelectedShapeIndex(null);
    setResizeHandle(null);

    if (tool === "pen") {
      setShapes((prev) => [
        ...prev,
        { type: "pen", points: [point], color: shapeColor },
      ]);
    }
  };

  const moveDraw = (e: any) => {
    if (!markupOpen) return;
    const point = getCanvasPoint(e);

    if (
      tool === "move" &&
      isDrawing &&
      selectedShapeIndex !== null &&
      shapes[selectedShapeIndex]
    ) {
      if (resizeHandle && shapes[selectedShapeIndex].type === "text") {
        setShapes((prev) =>
          prev.map((shape, index) =>
            index === selectedShapeIndex
              ? resizeTextShape(shape, resizeHandle, point)
              : shape
          )
        );
        return;
      }

      if (startPoint) {
        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        setShapes((prev) =>
          prev.map((shape, index) =>
            index === selectedShapeIndex
              ? moveShapeByDelta(shape, dx, dy)
              : shape
          )
        );
        setStartPoint(point);
        return;
      }
    }

    if (!isDrawing) return;

    if (tool === "pen") {
      setShapes((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.type === "pen") {
          last.points = [...last.points, point];
        }
        return next;
      });
    }
  };

  const endDraw = (e: any) => {
    if (!markupOpen) return;

    if (tool === "move") {
      setIsDrawing(false);
      setStartPoint(null);
      setResizeHandle(null);
      return;
    }

    if (!isDrawing || !startPoint) return;
    const point = getCanvasPoint(e);

    if (tool === "circle") {
      setShapes((prev) => {
        const next = [
          ...prev,
          {
            type: "circle",
            startX: startPoint.x,
            startY: startPoint.y,
            endX: point.x,
            endY: point.y,
            color: shapeColor,
          },
        ];
        setSelectedShapeIndex(next.length - 1);
        return next;
      });
    }

    if (tool === "arrow") {
      setShapes((prev) => {
        const next = [
          ...prev,
          {
            type: "arrow",
            startX: startPoint.x,
            startY: startPoint.y,
            endX: point.x,
            endY: point.y,
            color: shapeColor,
          },
        ];
        setSelectedShapeIndex(next.length - 1);
        return next;
      });
    }

    if (tool === "pen") {
      setSelectedShapeIndex(shapes.length - 1);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setResizeHandle(null);
  };

  const undoShape = () => {
    setShapes((prev) => prev.slice(0, -1));
    setSelectedShapeIndex((prev) => {
      if (prev === null || prev <= 0) return null;
      return prev - 1;
    });
    setResizeHandle(null);
  };

  const clearShapes = () => {
    setShapes([]);
    setSelectedShapeIndex(null);
    setResizeHandle(null);
  };

  const deleteSelectedShape = () => {
    if (selectedShapeIndex === null) return;
    setShapes((prev) =>
      prev.filter((_, index) => index !== selectedShapeIndex)
    );
    setSelectedShapeIndex(null);
    setResizeHandle(null);
  };

  const deselectShape = () => {
    setSelectedShapeIndex(null);
    setIsDrawing(false);
    setStartPoint(null);
    setResizeHandle(null);
  };

  const saveMarkup = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeEntry) return;
    setSelectedShapeIndex(null);

    setTimeout(() => {
      const annotatedImageData = canvas.toDataURL("image/png");
      updatePhotoEntry(
        activeEntry.id,
        "annotatedImageData",
        annotatedImageData
      );
      closeMarkupEditor();
    }, 0);
  };

  const renderCardHeader = (title: string, editStep: number) => (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="text-xl font-bold text-slate-800">{title}</div>
      {step === 7 ? (
        <button
          type="button"
          onClick={() => goToStep(editStep)}
          className="text-sm font-semibold text-sky-700 hover:underline"
        >
          Edit
        </button>
      ) : null}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <Card className="p-5 border-2 border-sky-200 bg-sky-50">
        <div className="text-xl font-bold text-slate-800 mb-2">
          Start by creating a nickname
        </div>
        <div className="text-slate-600 mb-4">
          This should match what the shop will recognize quickly in Printavo.
        </div>
        <div>
          <div className="font-semibold text-slate-800 mb-2">Job Nickname</div>
          <input
            value={form.jobNickname || ""}
            onChange={(e) => updateField("jobNickname", e.target.value)}
            placeholder="Example: Front Door Decals"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
          />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {[
          ["First Name", "firstName"],
          ["Last Name", "lastName"],
          ["Company", "company"],
          ["Phone", "phone"],
          ["Email - required to send Artwork request", "email"],
          ["Address", "address"],
          ["City", "city"],
          ["State", "state"],
          ["ZIP", "zip"],
        ].map(([label, key]) => (
          <div key={key}>
            <div className="font-semibold text-slate-800 mb-2">{label}</div>
            <input
              value={form[key] || ""}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
            />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
        <div className="text-sm font-semibold text-slate-500 mb-1">
          Customer Owner
        </div>
        <div className="text-lg font-semibold text-slate-800">
          {form.customerOwner}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          New customers will be assigned to the logged-in rep by default.
        </div>
      </div>
    </div>
  );

  const renderLineItemCard = (category: string) => {
    const lineItem =
      getLineItemForCategory(form, category) || makeLineItem(category);
    const needsFinish =
      category === "Printed Decals" || category === "Printed Magnets";
    const isOther = category === "Other";

    return (
      <Card key={category} className="p-5">
        <div className="text-lg font-bold text-slate-800 mb-4">{category}</div>

        {needsFinish ? (
          <div className="mb-5">
            <div className="font-semibold text-slate-800 mb-3">
              {category === "Printed Decals"
                ? "Printed Decals Finish"
                : "Printed Magnets Finish"}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FINISH_OPTIONS.map((item: string) => (
                <Tile
                  key={item}
                  label={item}
                  active={(lineItem.finish || "") === item}
                  onClick={() => handleLineItemChange(category, "finish", item)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {isOther ? (
          <div className="mb-5">
            <div className="font-semibold text-slate-800 mb-2">
              Describe Other
            </div>
            <input
              value={lineItem.otherDetails || ""}
              onChange={(e) =>
                handleLineItemChange(category, "otherDetails", e.target.value)
              }
              placeholder="Enter what the customer needs"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
            />
          </div>
        ) : null}

        <div className="grid md:grid-cols-[180px_1fr] gap-6">
          <div>
            <div className="font-semibold text-slate-800 mb-2">Quantity</div>
            <input
              value={lineItem.quantity || ""}
              onChange={(e) =>
                handleLineItemChange(category, "quantity", e.target.value)
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
              inputMode="numeric"
            />
          </div>

          <div>
            <div className="font-semibold text-slate-800 mb-2">Color</div>
            <input
              value={lineItem.color || ""}
              onChange={(e) =>
                handleLineItemChange(category, "color", e.target.value)
              }
              placeholder="Example: Full Color, Black, White"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="font-semibold text-slate-800 mb-2">Description</div>
          <textarea
            value={lineItem.description || ""}
            onChange={(e) =>
              handleLineItemChange(category, "description", e.target.value)
            }
            placeholder="Describe the job in a clean line-item way"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg min-h-28"
          />
        </div>
      </Card>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-xl font-semibold text-slate-800">
        What are we making?
      </div>
      <div className="text-slate-600">
        Select one or more categories. Each selected category gets its own line
        item details.
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PRINTAVO_CATEGORIES.map((category: string) => (
          <Tile
            key={category}
            label={category}
            active={(form.productTypes || []).includes(category)}
            onClick={() => handleToggleCategory(category)}
          />
        ))}
      </div>

      {(form.productTypes || []).length ? (
        <div className="space-y-5">
          {(form.productTypes || []).map((category: string) =>
            renderLineItemCard(category)
          )}
        </div>
      ) : null}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="font-semibold text-slate-800 mb-3">
            Indoor or outdoor?
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["Indoor", "Outdoor"].map((item) => (
              <Tile
                key={item}
                label={item}
                active={form.locationType === item}
                onClick={() => updateField("locationType", item)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="font-semibold text-slate-800 mb-3">Surface type</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {["Glass", "Wall", "Vehicle", "Metal", "Other"].map((item) => (
              <Tile
                key={item}
                label={item}
                active={form.surfaceType === item}
                onClick={() => updateField("surfaceType", item)}
              />
            ))}
          </div>

          {form.surfaceType === "Other" ? (
            <input
              value={form.surfaceOther || ""}
              onChange={(e) => updateField("surfaceOther", e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg mt-4"
              placeholder="Enter custom surface type"
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!form.installNeeded}
            onChange={(e) => updateField("installNeeded", e.target.checked)}
          />
          <span className="font-medium text-slate-800">
            Installation needed
          </span>
        </label>

        {form.installNeeded ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 text-sm">
            {installFeeMessage}
          </div>
        ) : null}

        {form.installNeeded ? (
          <div className="space-y-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!form.installSameAsCustomer}
                onChange={(e) =>
                  updateField("installSameAsCustomer", e.target.checked)
                }
              />
              <span className="font-medium text-slate-800">
                Same as customer address
              </span>
            </label>

            {!form.installSameAsCustomer ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  ["Install Address", "installAddress"],
                  ["Install City", "installCity"],
                  ["Install State", "installState"],
                  ["Install ZIP", "installZip"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <div className="font-semibold text-slate-800 mb-2">
                      {label}
                    </div>
                    <input
                      value={form[key] || ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xl font-semibold text-slate-800">
            Measurements & Photos
          </div>
          <div className="text-slate-600">
            Add a location when you are ready to upload a photo and capture
            measurements.
          </div>
        </div>

        <ActionButton className="text-lg" onClick={addPhotoEntry}>
          + Add Location
        </ActionButton>
      </div>

      {editingSubmittedOrder && (editModeArtworkLineItems.length || editModeArtworkReferenceImages.length) ? (
        <Card className="p-5 space-y-5">
          <div>
            <div className="text-xl font-semibold text-slate-800">
              Work Order / Artwork Reference
            </div>
            <div className="text-slate-600">
              These images come from the existing Printavo order so you can verify the artwork while editing this job.
            </div>
          </div>

          {editModeArtworkLineItems.length ? (
            <div className="space-y-5">
              {editModeArtworkLineItems.slice(0, 6).map((item: any, index: number) => (
                <div
                  key={item.id || `wizard-artwork-line-${index + 1}`}
                  className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  {item.imageUrl ? (
                    <div className="h-72 bg-white flex items-center justify-center p-3">
                      <img decoding="async" loading="lazy"
                        src={item.imageUrl}
                        alt={item.heading || `Line Item ${index + 1}`}
                        className="max-w-full max-h-full object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="h-72 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-500">
                      No artwork image loaded
                    </div>
                  )}

                  <div className="p-4 space-y-2 text-slate-700">
                    <div className="font-semibold text-slate-800 text-lg">
                      {item.heading || `Line Item ${index + 1}`}
                    </div>
                    <div>
                      <span className="font-semibold">Line Item #:</span>{" "}
                      {item.itemNumber || index + 1}
                    </div>
                    <div>
                      <span className="font-semibold">Quantity:</span>{" "}
                      {item.quantity || "N/A"}
                    </div>
                    {item.color ? (
                      <div>
                        <span className="font-semibold">Color:</span> {item.color}
                      </div>
                    ) : null}
                    {item.sizeLabel ? (
                      <div>
                        <span className="font-semibold">Printavo Size:</span>{" "}
                        {item.sizeLabel}
                      </div>
                    ) : null}
                    {item.description ? (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold">Description:</span>{" "}
                        {item.description}
                      </div>
                    ) : null}
                    {item.finish ? (
                      <div>
                        <span className="font-semibold">Finish:</span> {item.finish}
                      </div>
                    ) : null}
                    {item.otherDetails ? (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold">Details:</span>{" "}
                        {item.otherDetails}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!editModeArtworkLineItems.length && editModeArtworkReferenceImages.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {editModeArtworkReferenceImages.map((imageUrl: string, index: number) => (
                <div
                  key={`wizard-artwork-reference-${index}`}
                  className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  <div className="h-72 bg-white flex items-center justify-center p-3">
                    <img decoding="async" loading="lazy"
                      src={imageUrl}
                      alt={`Artwork Reference ${index + 1}`}
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                  </div>
                  <div className="p-4 text-slate-700 font-medium">
                    Artwork Reference {index + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-5 border-2 border-amber-200 bg-amber-50">
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!form.offsiteMeasurementsNeeded}
              onChange={(e) =>
                updateField("offsiteMeasurementsNeeded", e.target.checked)
              }
            />
            <span className="font-medium text-slate-800">
              Offsite measurements still need to be taken
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={!!form.unableToTakePhotosNow}
              onChange={(e) =>
                updateField("unableToTakePhotosNow", e.target.checked)
              }
            />
            <span className="font-medium text-slate-800">
              Rep is unable to take photos at this time
            </span>
          </label>

          <div className="text-sm text-slate-600">
            Use these when the rep needs the order started now, but site photos or measurements still need to be collected later.
          </div>
        </div>
      </Card>

      {!(form.photoEntries || []).length ? (
        <Card className="p-8 text-center">
          <div className="text-xl font-bold text-slate-800 mb-2">
            No locations added yet
          </div>
          <div className="text-slate-600">
            Tap <span className="font-semibold">Add Location</span> to create
            the first photo card.
          </div>
        </Card>
      ) : null}

      <div className="space-y-5">
        {(form.photoEntries || []).map((entry: any, index: number) => {
          const hasImage = !!(entry.imageData || entry.annotatedImageData);

          return (
            <Card key={entry.id} className="p-5">
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div className="font-semibold text-slate-800">
                    Location {index + 1} Measurements
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="font-semibold text-slate-800 mb-2">
                        Width
                      </div>
                      <div className="grid grid-cols-[1fr_112px] gap-2">
                        <input
                          value={entry.width || ""}
                          onChange={(e) =>
                            updatePhotoEntry(entry.id, "width", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                          inputMode="decimal"
                        />
                        <select
                          value={entry.widthUnit || "in"}
                          onChange={(e) =>
                            updatePhotoEntry(
                              entry.id,
                              "widthUnit",
                              e.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-base bg-white"
                        >
                          {MEASUREMENT_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-2">
                        Height
                      </div>
                      <div className="grid grid-cols-[1fr_112px] gap-2">
                        <input
                          value={entry.height || ""}
                          onChange={(e) =>
                            updatePhotoEntry(entry.id, "height", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                          inputMode="decimal"
                        />
                        <select
                          value={entry.heightUnit || "in"}
                          onChange={(e) =>
                            updatePhotoEntry(
                              entry.id,
                              "heightUnit",
                              e.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-base bg-white"
                        >
                          {MEASUREMENT_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-2">
                        Quantity
                      </div>
                      <input
                        value={entry.quantity || ""}
                        onChange={(e) =>
                          updatePhotoEntry(entry.id, "quantity", e.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-800 mb-2">
                      Location Label
                    </div>
                    <input
                      value={entry.name || ""}
                      onChange={(e) =>
                        updatePhotoEntry(entry.id, "name", e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                    />
                  </div>

                  {!hasImage ? (
                    <div>
                      <div className="font-semibold text-slate-800 mb-2">
                        Upload Photo
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handlePhotoUpload(
                            entry.id,
                            e.target.files?.[0] || null
                          )
                        }
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-white"
                      />
                    </div>
                  ) : null}

                  <div>
                    <div className="font-semibold text-slate-800 mb-2">
                      Markup Notes
                    </div>
                    <textarea
                      value={entry.markupNotes || ""}
                      onChange={(e) =>
                        updatePhotoEntry(
                          entry.id,
                          "markupNotes",
                          e.target.value
                        )
                      }
                      placeholder="Add notes like circle this area, place logo here, align to frame, etc."
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg min-h-24"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      className="px-4 py-2 text-sm"
                      variant="secondary"
                      onClick={() => movePhotoEntry(entry.id, -1)}
                      disabled={index === 0}
                    >
                      Move Up
                    </ActionButton>

                    <ActionButton
                      className="px-4 py-2 text-sm"
                      variant="secondary"
                      onClick={() => movePhotoEntry(entry.id, 1)}
                      disabled={index === (form.photoEntries || []).length - 1}
                    >
                      Move Down
                    </ActionButton>

                    {hasImage ? (
                      <>
                        <input
                          id={replaceInputIds[entry.id]}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            replacePhotoUpload(
                              entry.id,
                              e.target.files?.[0] || null
                            )
                          }
                        />
                        <ActionButton
                          className="px-4 py-2 text-sm"
                          variant="secondary"
                          onClick={() => {
                            const el = document.getElementById(
                              replaceInputIds[entry.id]
                            ) as HTMLInputElement | null;
                            el?.click();
                          }}
                        >
                          Replace Image
                        </ActionButton>
                      </>
                    ) : null}

                    <ActionButton
                      className="px-4 py-2 text-sm"
                      variant="secondary"
                      onClick={() => confirmDeletePhoto(entry.id)}
                    >
                      Delete Photo
                    </ActionButton>

                    <ActionButton
                      className="px-4 py-2 text-sm"
                      variant="secondary"
                      onClick={() => openMarkupEditor(entry)}
                      disabled={!hasImage}
                    >
                      Markup Photo
                    </ActionButton>
                  </div>

                  <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50">
                    {renderPhotoPreview(entry, index)}
                    <div className="p-4 font-medium text-slate-700">
                      {entry.name || `Location ${index + 1}`}
                    </div>
                    {entry.markupNotes ? (
                      <div className="px-4 pb-4 text-sm text-slate-600 whitespace-pre-wrap">
                        <span className="font-semibold text-slate-700">
                          Notes:
                        </span>{" "}
                        {entry.markupNotes}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <div className="font-semibold text-slate-800 mb-2">Artwork Status</div>
          <select
            value={form.logoStatus || "Customer provided"}
            onChange={(e) => updateField("logoStatus", e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
          >
            <option>Customer provided</option>
            <option>Needs design</option>
            <option>Recreate / Vectorize</option>
          </select>

          {showArtFeeMessage ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
              {artFeeMessage}
            </div>
          ) : null}
        </div>

        {form.logoStatus === "Customer provided" ? (
          <Card className="p-5 border-2 border-sky-200 bg-sky-50">
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!form.sendArtworkRequest}
                  onChange={(e) =>
                    updateField("sendArtworkRequest", e.target.checked)
                  }
                />
                <span className="font-medium text-slate-800">
                  Send artwork request email
                </span>
              </label>

              <div className="text-sm text-slate-600">
                Request the customer send artwork to info@decalmonkey.biz.
              </div>
            </div>
          </Card>
        ) : null}

        <div>
          <div className="font-semibold text-slate-800 mb-2">
            Specific colors to use or match
          </div>
          <input
            value={form.colorNotes || ""}
            onChange={(e) => updateField("colorNotes", e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
            placeholder="Example: match storefront blue, Pantone 186 C, use white vinyl"
          />
        </div>
      </div>

      <div>
        <div className="font-semibold text-slate-800 mb-2">
          {currentArtworkLabel}
        </div>
        <div className="text-sm text-slate-600 mb-2">{currentArtworkPrompt}</div>
        <textarea
          value={
            form.mockupInstructions === MOCKUP_PLACEHOLDER
              ? ""
              : form.mockupInstructions || ""
          }
          onChange={(e) => updateField("mockupInstructions", e.target.value)}
          placeholder={currentArtworkPrompt}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg min-h-32"
        />
      </div>

      <Card className="p-5">
        <div className="text-lg font-bold text-slate-800 mb-3">
          Production Files
        </div>
        <div className="text-slate-600 mb-4">
          Add artwork or reference files for the shop. These stay in the app for
          now.
        </div>

        <input
          type="file"
          multiple
          accept="image/*,.pdf,.ai,.eps,.svg"
          onChange={(e) => {
            handleProductionFilesUpload(e.target.files);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-white"
        />

        {(form.productionFiles || []).length ? (
          <div className="mt-4 space-y-3">
            {(form.productionFiles || []).map((file: any) => (
              <div
                key={file.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4"
              >
                <div className="text-slate-700 font-medium">{file.name}</div>
                <ActionButton
                  variant="secondary"
                  className="px-4 py-2 text-sm"
                  onClick={() => handleRemoveProductionFile(file.id)}
                >
                  Remove
                </ActionButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-slate-500">
            No production files added yet.
          </div>
        )}
      </Card>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-800">
          Additional Customer Inquiries
        </div>
        <div className="text-slate-600 mt-1">
          Capture extra things the customer asks about so your team can turn
          them into future sales.
        </div>
      </div>

      <div>
        <div className="font-semibold text-slate-800 mb-2">
          Additional customer inquiries
        </div>
        <textarea
          value={form.additionalInquiries || ""}
          onChange={(e) => updateField("additionalInquiries", e.target.value)}
          placeholder="Example: customer also asked about window perf, fleet wraps, banners, or storefront hours updates"
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg min-h-40"
        />
      </div>
    </div>
  );

  const installAddressText = form.installNeeded
    ? form.installSameAsCustomer
      ? `${form.address || ""}, ${form.city || ""}, ${form.state || ""} ${
          form.zip || ""
        }`.trim()
      : `${form.installAddress || ""}, ${form.installCity || ""}, ${
          form.installState || ""
        } ${form.installZip || ""}`.trim()
    : "No installation needed";

  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          {renderCardHeader("Customer & Contact", 1)}
          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Customer:</span> {form.firstName}{" "}
              {form.lastName}
            </div>
            <div>
              <span className="font-semibold">Company:</span>{" "}
              {form.company || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Phone:</span>{" "}
              {form.phone || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Email:</span>{" "}
              {form.email || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Address:</span> {form.address},{" "}
              {form.city}, {form.state} {form.zip}
            </div>
            <div>
              <span className="font-semibold">Owner:</span> {form.customerOwner}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          {renderCardHeader("Order Setup", 2)}
          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Making:</span>{" "}
              {(form.productTypes || []).join(", ") || "None selected"}
            </div>
            <div>
              <span className="font-semibold">Location Type:</span>{" "}
              {form.locationType || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Surface:</span>{" "}
              {form.surfaceType === "Other" && form.surfaceOther
                ? form.surfaceOther
                : form.surfaceType || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Mock Up Instructions:</span>{" "}
              {form.mockupInstructions &&
              form.mockupInstructions !== MOCKUP_PLACEHOLDER
                ? form.mockupInstructions
                : "None entered"}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        {renderCardHeader("Line Items", 2)}
        {(form.lineItems || []).length ? (
          <div className="space-y-4">
            {(form.lineItems || []).map((item: any) => (
              <div
                key={item.id || item.category}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700"
              >
                <div className="font-semibold text-slate-800 mb-2">
                  {item.category}
                </div>
                <div>
                  <span className="font-semibold">Quantity:</span>{" "}
                  {item.quantity || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Color:</span>{" "}
                  {item.color || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Description:</span>{" "}
                  {item.description || "N/A"}
                </div>
                {item.finish ? (
                  <div>
                    <span className="font-semibold">Finish:</span> {item.finish}
                  </div>
                ) : null}
                {item.otherDetails ? (
                  <div>
                    <span className="font-semibold">Other Details:</span>{" "}
                    {item.otherDetails}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-700">No line items added.</div>
        )}
      </Card>

      <Card className="p-5 border-2 border-slate-300 bg-slate-50">
        {renderCardHeader("Install Details", 3)}
        <div className="space-y-2 text-slate-700">
          <div>
            <span className="font-semibold">Installation Needed:</span>{" "}
            {form.installNeeded ? "Yes" : "No"}
          </div>
          {form.installNeeded ? (
            <>
              <div>
                <span className="font-semibold">Same as Customer Address:</span>{" "}
                {form.installSameAsCustomer ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Install Address:</span>{" "}
                {installAddressText}
              </div>
            </>
          ) : null}
          <div>
            <span className="font-semibold">Offsite Measurements Needed:</span>{" "}
            {form.offsiteMeasurementsNeeded ? "Yes" : "No"}
          </div>
          <div>
            <span className="font-semibold">Unable to Take Photos Now:</span>{" "}
            {form.unableToTakePhotosNow ? "Yes" : "No"}
          </div>
          <div className="text-sm text-slate-600 pt-2">
            CSR should review this section for travel charges, install fees,
            scheduling, and any on-site requirements before finalizing the
            quote.
          </div>

          {form.installNeeded ? (
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 text-sm">
              {installFeeMessage}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          {renderCardHeader("Artwork Status", 5)}
          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Logo Status:</span>{" "}
              {form.logoStatus || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Specific Colors to Use or Match:</span>{" "}
              {form.colorNotes || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Artwork Status:</span>{" "}
              {form.artworkStatus || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Artwork Request Email:</span>{" "}
              {form.sendArtworkRequest ? "Yes" : "No"}
            </div>

            {showArtFeeMessage ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                {artFeeMessage}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          {renderCardHeader("Photo Entries", 4)}
          <div className="space-y-4 text-slate-700">
            {(form.photoEntries || []).length ? (
              (form.photoEntries || []).map((entry: any, index: number) => (
                <div
                  key={entry.id}
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-3"
                >
                  <div className="font-semibold text-slate-800 mb-2">
                    {entry.name || `Location ${index + 1}`}
                  </div>

                  {entry.annotatedImageData || entry.imageData ? (
                    <img decoding="async" loading="lazy"
                      src={entry.annotatedImageData || entry.imageData}
                      alt={entry.name || `Photo ${index + 1}`}
                      className="w-full h-40 object-cover rounded-xl border border-slate-200 mb-3"
                    />
                  ) : null}

                  <div>
                    {formatDimension(entry.width, entry.widthUnit)}
                    {entry.width || entry.height ? " × " : ""}
                    {formatDimension(entry.height, entry.heightUnit) ||
                      (!entry.width ? "" : "")}
                  </div>
                  <div>Quantity: {entry.quantity}</div>

                  {entry.markupNotes ? (
                    <div className="text-sm text-slate-600 whitespace-pre-wrap mt-2">
                      <span className="font-semibold text-slate-700">
                        Notes:
                      </span>{" "}
                      {entry.markupNotes}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div>No photo entries added.</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        {renderCardHeader("Production Files", 5)}
        <div className="space-y-3 text-slate-700">
          {(form.productionFiles || []).length ? (
            (form.productionFiles || []).map((file: any) => (
              <div
                key={file.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                {file.name}
              </div>
            ))
          ) : (
            <div>No production files added.</div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        {renderCardHeader("Additional Customer Inquiries", 6)}
        <div className="text-slate-700">
          {form.additionalInquiries || "None entered"}
        </div>
      </Card>
    </div>
  );

  return (
    <>
      <Shell
        title={steps[step - 1]}
        subtitle={
          editingSubmittedOrder
            ? `Editing ${
                editingSubmittedOrder.printavoQuoteNumber ||
                editingSubmittedOrder.invoiceNumber ||
                editingSubmittedOrder.id
              }`
            : "New Order Wizard"
        }
        showProgress
        step={step}
        totalSteps={totalSteps}
        steps={steps}
      >
        {step === 1 ? renderStep1() : null}
        {step === 2 ? renderStep2() : null}
        {step === 3 ? renderStep3() : null}
        {step === 4 ? renderStep4() : null}
        {step === 5 ? renderStep5() : null}
        {step === 6 ? renderStep6() : null}
        {step === 7 ? renderStep7() : null}

        <div className="pt-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-3 flex-wrap">
            <ActionButton
              variant="secondary"
              onClick={() => {
                if (editingSubmittedOrder) {
                  submitOrder();
                } else {
                  handleSaveDraft();
                }
              }}
              disabled={submitState.loading || !hasUnsavedChanges}
            >
              {editingSubmittedOrder ? "Save Changes" : "Save Draft"}
            </ActionButton>

            <ActionButton
              variant="secondary"
              onClick={() => {
                if (!hasUnsavedChanges) {
                  goHomeNow();
                  return;
                }
                setGoHomeModalOpen(true);
              }}
            >
              Go Home
            </ActionButton>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <ActionButton variant="secondary" onClick={handleBack}>
              Back
            </ActionButton>

            {step < totalSteps ? (
              <ActionButton
                onClick={() => goToStep(Math.min(totalSteps, step + 1))}
              >
                Next
              </ActionButton>
            ) : (
              <ActionButton
                onClick={submitOrder}
                disabled={submitState.loading}
              >
                {submitState.loading
                  ? editingSubmittedOrder
                    ? "Updating..."
                    : "Submitting..."
                  : editingSubmittedOrder
                  ? "Update Order"
                  : "Submit Order"}
              </ActionButton>
            )}
          </div>
        </div>
      </Shell>

      {markupOpen && activeEntry ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-auto">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  Markup Photo
                </div>
                <div className="text-sm text-slate-500">
                  Draw lines, circles, arrows, place notes, or switch to Move to
                  reposition markup.
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <ActionButton
                  variant={tool === "move" ? "primary" : "secondary"}
                  onClick={() => setTool("move")}
                >
                  Move
                </ActionButton>
                <ActionButton
                  variant={tool === "pen" ? "primary" : "secondary"}
                  onClick={() => setTool("pen")}
                >
                  Pen
                </ActionButton>
                <ActionButton
                  variant={tool === "circle" ? "primary" : "secondary"}
                  onClick={() => setTool("circle")}
                >
                  Circle
                </ActionButton>
                <ActionButton
                  variant={tool === "arrow" ? "primary" : "secondary"}
                  onClick={() => setTool("arrow")}
                >
                  Arrow
                </ActionButton>
                <ActionButton
                  variant={tool === "text" ? "primary" : "secondary"}
                  onClick={() => setTool("text")}
                >
                  Text
                </ActionButton>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
                {tool === "text" ? (
                  <div>
                    <div className="font-semibold text-slate-800 mb-2">
                      Text Label
                    </div>
                    <input
                      value={textNote}
                      onChange={(e) => setTextNote(e.target.value)}
                      placeholder="Enter note, then click on the image to place it"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                ) : (
                  <div />
                )}

                <div>
                  <div className="font-semibold text-slate-800 mb-2">
                    Markup Color
                  </div>
                  <input
                    type="color"
                    value={shapeColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setShapeColor(newColor);
                      if (selectedShapeIndex !== null) {
                        setShapes((prev) =>
                          prev.map((shape, index) =>
                            index === selectedShapeIndex
                              ? { ...shape, color: newColor }
                              : shape
                          )
                        );
                      }
                    }}
                    className="h-12 w-20 rounded-xl border border-slate-300 bg-white p-1"
                  />
                </div>
              </div>

              {tool === "move" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
                  Tap or click an existing markup item to select it, then drag
                  it to move it. Text can also be resized using the blue corner
                  handles.
                </div>
              ) : null}

              {selectedShapeIndex !== null ? (
                <div className="flex gap-3 flex-wrap">
                  <ActionButton variant="secondary" onClick={deselectShape}>
                    Deselect
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    onClick={deleteSelectedShape}
                  >
                    Delete Selected
                  </ActionButton>
                </div>
              ) : null}

              <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <canvas
                  ref={canvasRef}
                  className="max-w-full touch-none border border-slate-200 bg-white rounded-xl"
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                <ActionButton variant="secondary" onClick={undoShape}>
                  Undo
                </ActionButton>
                <ActionButton variant="secondary" onClick={clearShapes}>
                  Clear
                </ActionButton>
                <ActionButton variant="secondary" onClick={closeMarkupEditor}>
                  Cancel
                </ActionButton>
                <ActionButton onClick={saveMarkup}>Save Markup</ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {saveDraftToast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-800 font-semibold shadow-2xl">
          {saveDraftToast}
        </div>
      ) : null}

      {confirmModal.open ? (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200">
            <div className="p-6">
              <div className="text-2xl font-bold text-slate-800">
                {confirmModal.title}
              </div>
              <div className="mt-3 text-slate-600">{confirmModal.message}</div>

              <div className="mt-6 flex gap-3 justify-end flex-wrap">
                {confirmModal.cancelLabel ? (
                  <ActionButton variant="secondary" onClick={closeConfirmModal}>
                    {confirmModal.cancelLabel}
                  </ActionButton>
                ) : null}
                <ActionButton onClick={() => confirmModal.onConfirm?.()}>
                  {confirmModal.confirmLabel}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {goHomeModalOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200">
            <div className="p-6">
              <div className="text-2xl font-bold text-slate-800">
                Save Before Exiting?
              </div>
              <div className="mt-3 text-slate-600">
                {!hasUnsavedChanges
                  ? "There are no unsaved changes. You can go home safely."
                  : editingSubmittedOrder
                  ? "Do you want to save your changes before going home?"
                  : "Do you want to save this order as a draft before going home?"}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <ActionButton
                  className="w-full"
                  onClick={handleSaveAndGoHome}
                  disabled={submitState.loading}
                >
                  {editingSubmittedOrder
                    ? "Save Changes & Go Home"
                    : "Save & Go Home"}
                </ActionButton>

                <ActionButton
                  className="w-full"
                  variant="secondary"
                  onClick={handleGoHomeWithoutSaving}
                >
                  Go Home Without Saving
                </ActionButton>

                <ActionButton
                  className="w-full"
                  variant="secondary"
                  onClick={() => setGoHomeModalOpen(false)}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
