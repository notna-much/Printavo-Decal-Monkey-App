import { useEffect, useMemo, useRef, useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";

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

export default function MeasurementScreen({
  form,
  updateField,
  addPhotoEntry,
  updatePhotoEntry,
  movePhotoEntry,
  deletePhotoEntry,
  submitMeasurements,
  submitState,
  setScreen,
  selectedMeasurement,
}: any) {
  const [markupOpen, setMarkupOpen] = useState(false);
  const [activeMarkupEntryId, setActiveMarkupEntryId] = useState<number | null>(null);
  const [tool, setTool] = useState("pen");
  const [textNote, setTextNote] = useState("");
  const [shapeColor, setShapeColor] = useState("#ef4444");
  const [shapes, setShapes] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [remoteJobDetails, setRemoteJobDetails] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const activeEntry =
    (form.photoEntries || []).find((entry: any) => entry.id === activeMarkupEntryId) || null;

  const replaceInputIds = useMemo(() => {
    const map: Record<number, string> = {};
    (form.photoEntries || []).forEach((entry: any) => {
      map[entry.id] = `measurement-replace-photo-${entry.id}`;
    });
    return map;
  }, [form.photoEntries]);

  const handlePhotoUpload = (entryId: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updatePhotoEntry(entryId, "imageData", reader.result);
      updatePhotoEntry(entryId, "annotatedImageData", "");
    };
    reader.readAsDataURL(file);
  };

  const getPreviewSrc = (entry: any) => entry?.annotatedImageData || entry?.imageData || "";

  const artworkLineItems = useMemo(() => {
    const safeLineItems = Array.isArray(remoteJobDetails?.lineItems)
      ? remoteJobDetails.lineItems
      : Array.isArray(form?.lineItems)
      ? form.lineItems
      : [];
    return safeLineItems
      .map((item: any, index: number) => ({
        id: item?.id || `workorder-line-${index + 1}`,
        heading: item?.category || `Line Item ${item?.itemNumber || index + 1}`,
        itemNumber: item?.itemNumber || String(index + 1),
        quantity: item?.quantity || "",
        color: item?.color || "",
        description: item?.description || "",
        otherDetails: item?.otherDetails || "",
        sizeLabel: item?.sizeLabel || "",
        imageUrl: item?.imageUrl || "",
      }))
      .filter((item: any) => item.imageUrl || item.description || item.otherDetails || item.color);
  }, [form?.lineItems]);

  const artworkReferenceImages = useMemo<string[]>(() => {
    const raw = Array.isArray(remoteJobDetails?.artworkReferenceImages)
      ? (remoteJobDetails.artworkReferenceImages as any[])
      : Array.isArray(selectedMeasurement?.artworkReferenceImages)
      ? (selectedMeasurement.artworkReferenceImages as any[])
      : [];
    return Array.from(
      new Set(
        raw.map((value: any) => String(value || "").trim()).filter(Boolean)
      )
    );
  }, [selectedMeasurement?.artworkReferenceImages]);

  useEffect(() => {
    let cancelled = false;

    const loadMeasurementDetails = async () => {
      if (!selectedMeasurement?.printavoQuoteId) {
        setRemoteJobDetails(null);
        return;
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/printavo/measurement-job-details/${selectedMeasurement.printavoQuoteId}`
        );
        const data = await response.json();
        if (!response.ok || !data?.ok) return;
        if (!cancelled) {
          setRemoteJobDetails(data.job || null);
        }
      } catch {
        if (!cancelled) {
          setRemoteJobDetails(null);
        }
      }
    };

    loadMeasurementDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedMeasurement?.printavoQuoteId]);

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

  const distanceBetweenPoints = (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

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

    if (dx === 0 && dy === 0) return distanceBetweenPoints(px, py, x1, y1);

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
    const width = Math.max((shape.text || "").length * fontSize * 0.58, 60 * scale);
    const height = fontSize + 14;
    return { fontSize, width, height };
  };

  const getShapeBounds = (shape: any) => {
    if (shape.type === "text") {
      const { fontSize, width, height } = getTextMetrics(shape);
      return { left: shape.x - 8, top: shape.y - fontSize, width: width + 16, height };
    }

    if (shape.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2)
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
      return { left: left - 10, top: top - 10, width: right - left + 20, height: bottom - top + 20 };
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

  const getResizeHandleAtPoint = (shape: any, point: { x: number; y: number }) => {
    if (shape.type !== "text") return null;
    const bounds = getShapeBounds(shape);
    if (!bounds) return null;

    const handles = [
      { name: "nw", x: bounds.left, y: bounds.top },
      { name: "ne", x: bounds.left + bounds.width, y: bounds.top },
      { name: "sw", x: bounds.left, y: bounds.top + bounds.height },
      { name: "se", x: bounds.left + bounds.width, y: bounds.top + bounds.height },
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
        Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2)
      );
      const distance = distanceBetweenPoints(point.x, point.y, shape.startX, shape.startY);
      return Math.abs(distance - radius) <= tolerance;
    }

    if (shape.type === "arrow") {
      return (
        distanceToSegment(point.x, point.y, shape.startX, shape.startY, shape.endX, shape.endY) <=
        tolerance
      );
    }

    if (shape.type === "pen") {
      if (!shape.points || shape.points.length < 2) return false;
      for (let i = 0; i < shape.points.length - 1; i += 1) {
        const a = shape.points[i];
        const b = shape.points[i + 1];
        if (distanceToSegment(point.x, point.y, a.x, a.y, b.x, b.y) <= tolerance) {
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
    if (shape.type === "text") return { ...shape, x: shape.x + dx, y: shape.y + dy };
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
        points: shape.points.map((point: any) => ({ x: point.x + dx, y: point.y + dy })),
      };
    }
    return shape;
  };

  const resizeTextShape = (shape: any, handle: string, point: { x: number; y: number }) => {
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
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
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
          Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2)
        );
        ctx.beginPath();
        ctx.arc(shape.startX, shape.startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (shape.type === "arrow") {
        const headLength = 14;
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
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

  const openMarkupEditor = (entry: any) => {
    if (!entry.imageData) return;
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

  const startDraw = (e: any) => {
    if (!markupOpen) return;
    const point = getCanvasPoint(e);

    if (tool === "move") {
      if (selectedShapeIndex !== null && shapes[selectedShapeIndex]?.type === "text") {
        const handle = getResizeHandleAtPoint(shapes[selectedShapeIndex], point);
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
      if (!textNote.trim()) return;
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
      setShapes((prev) => [...prev, { type: "pen", points: [point], color: shapeColor }]);
    }
  };

  const moveDraw = (e: any) => {
    if (!markupOpen) return;
    const point = getCanvasPoint(e);

    if (tool === "move" && isDrawing && selectedShapeIndex !== null && shapes[selectedShapeIndex]) {
      if (resizeHandle && shapes[selectedShapeIndex].type === "text") {
        setShapes((prev) =>
          prev.map((shape, index) =>
            index === selectedShapeIndex ? resizeTextShape(shape, resizeHandle, point) : shape
          )
        );
        return;
      }

      if (startPoint) {
        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        setShapes((prev) =>
          prev.map((shape, index) =>
            index === selectedShapeIndex ? moveShapeByDelta(shape, dx, dy) : shape
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
        if (last && last.type === "pen") last.points = [...last.points, point];
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

    if (tool === "pen") setSelectedShapeIndex(shapes.length - 1);

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
    setShapes((prev) => prev.filter((_, index) => index !== selectedShapeIndex));
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
      updatePhotoEntry(activeEntry.id, "annotatedImageData", annotatedImageData);
      closeMarkupEditor();
    }, 0);
  };

  return (
    <Shell
      title="Take Measurements"
      subtitle="Capture measurements and images, then submit and return home"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xl font-bold text-slate-800">
            {selectedMeasurement?.printavoQuoteNumber ||
              selectedMeasurement?.invoiceNumber ||
              selectedMeasurement?.id ||
              "Measurement Job"}
            {" - "}
            {selectedMeasurement?.nickname ||
              selectedMeasurement?.company ||
              selectedMeasurement?.customer ||
              "Untitled"}
          </div>
          <div className="text-slate-700 font-medium mt-1">
            {[form.firstName, form.lastName].filter(Boolean).join(" ") ||
              selectedMeasurement?.customer ||
              "Unknown Customer"}
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {[form.address, form.city, form.state, form.zip].filter(Boolean).join(", ") ||
              "No address available"}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5 space-y-4">
            <div className="text-lg font-bold text-slate-800">Install Details</div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!form.installNeeded}
                onChange={(e) => updateField("installNeeded", e.target.checked)}
              />
              <span className="font-medium text-slate-800">Installation needed</span>
            </label>

            {form.installNeeded ? (
              <>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!form.installSameAsCustomer}
                    onChange={(e) => updateField("installSameAsCustomer", e.target.checked)}
                  />
                  <span className="font-medium text-slate-800">Same as customer address</span>
                </label>

                {!form.installSameAsCustomer ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Install Address", "installAddress"],
                      ["Install City", "installCity"],
                      ["Install State", "installState"],
                      ["Install ZIP", "installZip"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <div className="font-semibold text-slate-800 mb-2">{label}</div>
                        <input
                          value={form[key] || ""}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-xl"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>

          <Card className="p-5 space-y-4">
            <div className="text-lg font-bold text-slate-800">Field Notes</div>
            <div>
              <div className="font-semibold text-slate-800 mb-2">Customer / Field Notes</div>
              <textarea
                value={form.additionalInquiries || ""}
                onChange={(e) => updateField("additionalInquiries", e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-xl min-h-32"
                placeholder="Anything the shop should know from the measurement visit"
              />
            </div>
          </Card>
        </div>

        {(artworkLineItems.length || artworkReferenceImages.length) ? (
          <Card className="p-5 space-y-5">
            <div>
              <div className="text-xl font-semibold text-slate-800">Work Order / Artwork Reference</div>
              <div className="text-slate-600">
                These come from Printavo line items and artwork reference images so the field rep can verify what should be measured.
              </div>
            </div>

            {artworkLineItems.length ? (
              <div className="space-y-5">
                {artworkLineItems.slice(0, 6).map((item: any, index: number) => (
                  <div
                    key={item.id || `artwork-line-${index + 1}`}
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

            {artworkLineItems.length > 6 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Showing the first 6 artwork references for speed. The remaining line items are still part of the work order.
              </div>
            ) : null}

            {!artworkLineItems.length && artworkReferenceImages.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {artworkReferenceImages.map((imageUrl: string, index: number) => (
                  <div
                    key={`artwork-reference-${index}`}
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

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xl font-semibold text-slate-800">Field Photos & Measurements</div>
            <div className="text-slate-600">
              Add supporting field photos and measurement cards for the rep visit.
            </div>
          </div>

          <ActionButton className="text-lg" onClick={addPhotoEntry}>
            + Add Location
          </ActionButton>
        </div>

        {!(form.photoEntries || []).length ? (
          <Card className="p-8 text-center">
            <div className="text-xl font-bold text-slate-800 mb-2">No locations added yet</div>
            <div className="text-slate-600">Tap Add Location to create the first measurement card.</div>
          </Card>
        ) : null}

        <div className="space-y-5">
          {(form.photoEntries || []).map((entry: any, index: number) => {
            const previewSrc = getPreviewSrc(entry);
            return (
              <Card key={entry.id} className="p-5">
                <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr] items-start">
                  <div className="space-y-4">
                    <div className="font-semibold text-slate-800 text-xl">Location {index + 1} Measurements</div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-2">Location Label</div>
                      <input
                        value={entry.name || ""}
                        onChange={(e) => updatePhotoEntry(entry.id, "name", e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-xl"
                        placeholder="Front door, east window, trailer side, etc."
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                        <div className="font-semibold text-slate-800 mb-2">Width</div>
                        <input
                          value={entry.width || ""}
                          onChange={(e) => updatePhotoEntry(entry.id, "width", e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-5 py-6 text-4xl leading-none"
                          inputMode="decimal"
                          placeholder="0"
                        />
                        <select
                          value={entry.widthUnit || "in"}
                          onChange={(e) => updatePhotoEntry(entry.id, "widthUnit", e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl bg-white mt-3"
                        >
                          {MEASUREMENT_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                        <div className="font-semibold text-slate-800 mb-2">Height</div>
                        <input
                          value={entry.height || ""}
                          onChange={(e) => updatePhotoEntry(entry.id, "height", e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-5 py-6 text-4xl leading-none"
                          inputMode="decimal"
                          placeholder="0"
                        />
                        <select
                          value={entry.heightUnit || "in"}
                          onChange={(e) => updatePhotoEntry(entry.id, "heightUnit", e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl bg-white mt-3"
                        >
                          {MEASUREMENT_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                        <div className="font-semibold text-slate-800 mb-2">Quantity</div>
                        <input
                          value={entry.quantity || ""}
                          onChange={(e) => updatePhotoEntry(entry.id, "quantity", e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-5 py-6 text-4xl leading-none"
                          inputMode="numeric"
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-2">Markup Notes</div>
                      <textarea
                        value={entry.markupNotes || ""}
                        onChange={(e) => updatePhotoEntry(entry.id, "markupNotes", e.target.value)}
                        placeholder="Add notes like center over frame, leave 1 inch margin, logo on lower panel, etc."
                        className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-xl min-h-28"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton className="px-4 py-2 text-sm" variant="secondary" onClick={() => movePhotoEntry(entry.id, -1)} disabled={index === 0}>
                        Move Up
                      </ActionButton>
                      <ActionButton className="px-4 py-2 text-sm" variant="secondary" onClick={() => movePhotoEntry(entry.id, 1)} disabled={index === (form.photoEntries || []).length - 1}>
                        Move Down
                      </ActionButton>
                      <ActionButton className="px-4 py-2 text-sm" variant="secondary" onClick={() => deletePhotoEntry(entry.id)}>
                        Delete Location
                      </ActionButton>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold text-slate-800 mb-2">Photo</div>
                      {previewSrc ? (
                        <img decoding="async" loading="lazy"
                          src={previewSrc}
                          alt={entry.name || `Measurement ${index + 1}`}
                          className="w-full rounded-2xl border border-slate-200 object-cover max-h-[420px] bg-slate-100"
                        />
                      ) : (
                        <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 min-h-[280px] flex items-center justify-center text-slate-500">
                          No image yet
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-2">{previewSrc ? "Replace Photo" : "Upload Photo"}</div>
                      <input
                        id={replaceInputIds[entry.id]}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(entry.id, e.target.files?.[0] || null)}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base bg-white"
                      />
                    </div>

                    {previewSrc ? (
                      <div className="flex flex-wrap gap-2">
                        <ActionButton variant="secondary" onClick={() => document.getElementById(replaceInputIds[entry.id])?.click()}>
                          Replace Photo
                        </ActionButton>
                        <ActionButton onClick={() => openMarkupEditor(entry)}>Markup Photo</ActionButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {submitState?.message ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            {submitState.message}
          </div>
        ) : null}

        <div className="pt-4 flex items-center justify-between gap-4 flex-wrap">
          <ActionButton variant="secondary" onClick={() => setScreen("existing")}>Back to Offsite Measurements</ActionButton>
          <ActionButton onClick={submitMeasurements} disabled={!!submitState?.loading}>
            {submitState?.loading ? "Submitting..." : "Submit Measurements"}
          </ActionButton>
        </div>
      </div>

      {markupOpen && activeEntry ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-auto">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-slate-800">Markup Photo</div>
                <div className="text-sm text-slate-500">
                  Draw lines, circles, arrows, place notes, or switch to Move to reposition markup.
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <ActionButton variant={tool === "move" ? "primary" : "secondary"} onClick={() => setTool("move")}>Move</ActionButton>
                <ActionButton variant={tool === "pen" ? "primary" : "secondary"} onClick={() => setTool("pen")}>Pen</ActionButton>
                <ActionButton variant={tool === "circle" ? "primary" : "secondary"} onClick={() => setTool("circle")}>Circle</ActionButton>
                <ActionButton variant={tool === "arrow" ? "primary" : "secondary"} onClick={() => setTool("arrow")}>Arrow</ActionButton>
                <ActionButton variant={tool === "text" ? "primary" : "secondary"} onClick={() => setTool("text")}>Text</ActionButton>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
                {tool === "text" ? (
                  <div>
                    <div className="font-semibold text-slate-800 mb-2">Text Label</div>
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
                  <div className="font-semibold text-slate-800 mb-2">Markup Color</div>
                  <input
                    type="color"
                    value={shapeColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setShapeColor(newColor);
                      if (selectedShapeIndex !== null) {
                        setShapes((prev) =>
                          prev.map((shape, index) =>
                            index === selectedShapeIndex ? { ...shape, color: newColor } : shape
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
                  Tap or click an existing markup item to select it, then drag it to move it. Text can also be resized using the blue corner handles.
                </div>
              ) : null}

              {selectedShapeIndex !== null ? (
                <div className="flex gap-3 flex-wrap">
                  <ActionButton variant="secondary" onClick={deselectShape}>Deselect</ActionButton>
                  <ActionButton variant="secondary" onClick={deleteSelectedShape}>Delete Selected</ActionButton>
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
                <ActionButton variant="secondary" onClick={undoShape}>Undo</ActionButton>
                <ActionButton variant="secondary" onClick={clearShapes}>Clear</ActionButton>
                <ActionButton variant="secondary" onClick={closeMarkupEditor}>Cancel</ActionButton>
                <ActionButton onClick={saveMarkup}>Save Markup</ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
