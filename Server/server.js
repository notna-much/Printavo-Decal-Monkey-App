import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3001;
const PRINTAVO_URL = "https://www.printavo.com/api/v2";
const PRINTAVO_INQUIRY_FORM_URL = "https://www.printavo.com/form/inquiries";
const PRINTAVO_INQUIRY_KEY = String(process.env.PRINTAVO_INQUIRY_KEY || "").trim();
const PRINTAVO_ONE_SIZE = "size_other";

const MEASUREMENT_STATUS_ID = "527706";
const MEASUREMENT_COMPLETE_STATUS_ID = "533869";
const INSTALL_READY_STATUS_ID = "398969";
const INSTALLED_STATUS_ID = "400075";
const INSTALL_ISSUE_STATUS_ID = "533842";

const clean = (v) => String(v || "").trim();

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeFilename(name = "file") {
  const ext = path.extname(name);
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "") || ".jpg";
  return `${base || "file"}${safeExt}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const now = Date.now();
    cb(null, `${now}-${sanitizeFilename(file.originalname)}`);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(uploadDir));

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextWeekDateTime() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function buildContactName(form) {
  return [clean(form.firstName), clean(form.lastName)]
    .filter(Boolean)
    .join(" ");
}

function buildNickname(form) {
  const explicitNickname =
    clean(form.jobNickname) || clean(form.nickname) || clean(form.printavoNickname);
  if (explicitNickname) return explicitNickname;

  const company = clean(form.company);
  const fullName = buildContactName(form);
  const product =
    Array.isArray(form.productTypes) && form.productTypes.length > 0
      ? form.productTypes[0]
      : "Quote";

  return `${company || fullName || "Customer"} - ${product}`;
}

function normalizeQuantity(value) {
  const parsed = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function normalizeLineItems(form) {
  if (!Array.isArray(form?.lineItems)) return [];

  return form.lineItems
    .map((item, index) => ({
      id: item?.id || `line-item-${index + 1}`,
      category: clean(item?.category),
      quantity: normalizeQuantity(item?.quantity),
      color: clean(item?.color),
      description: clean(item?.description),
      finish: clean(item?.finish),
      otherDetails: clean(item?.otherDetails),
    }))
    .filter(
      (item) =>
        item.category ||
        item.description ||
        item.color ||
        item.finish ||
        item.otherDetails
    );
}

function buildLineItemDescription(item) {
  return [
    item.category ? `Category: ${item.category}` : null,
    item.description ? item.description : null,
    item.finish ? `Finish: ${item.finish}` : null,
    item.otherDetails ? `Details: ${item.otherDetails}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildLineItemCreateInput(item, index) {
  return {
    itemNumber: String(index + 1),
    position: index + 1,
    color: item.color || undefined,
    description: buildLineItemDescription(item) || undefined,
    sizes: [
      {
        size: PRINTAVO_ONE_SIZE,
        count: item.quantity,
      },
    ],
    taxed: true,
  };
}

function buildLineItemGroupCreateInput(form) {
  const items = normalizeLineItems(form);
  if (!items.length) return [];

  return [
    {
      position: 1,
      lineItems: items.map((item, index) =>
        buildLineItemCreateInput(item, index)
      ),
    },
  ];
}

function appendUrlBlock(label, urls) {
  const safeUrls = Array.isArray(urls)
    ? urls.map((url) => clean(url)).filter(Boolean)
    : [];

  if (!safeUrls.length) return null;

  return `${label}:\n${safeUrls.join("\n")}`;
}

function valuesEqual(a, b) {
  return clean(a) === clean(b);
}

function parseLatestValue(block, label) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}:\\s*(.+)$`, "gim");
  let match;
  let latest = "";
  while ((match = regex.exec(String(block || "")))) {
    latest = clean(match[1]);
  }
  return latest;
}

function parseSimpleSection(text, label) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `${escaped}:\\n([\\s\\S]*?)(?:\\n\\n(?:Field Update \\(|Products:|Line Items:|Location Type:|Surface:|Install Needed:|Mockup:|Customer Notes:|Field Photos \\/ Measurements:|Uploaded Artwork \\/ Files:|-----\\n)|$)`,
    "gi"
  );

  let match;
  let latest = "";

  while ((match = regex.exec(String(text || "")))) {
    latest = clean(match[1]);
  }

  return latest;
}

function parseInstallNeededFromNote(text) {
  const match = String(text || "").match(/^Install Needed:\s*(Yes|No)$/im);
  return match ? match[1].toLowerCase() === "yes" : null;
}

function parseInstallSameAddressFromNote(text) {
  const match = String(text || "").match(/^Same as Customer Address:\s*(Yes|No)$/im);
  return match ? match[1].toLowerCase() === "yes" : null;
}

function parseCustomerCompanyFromNote(text) {
  return parseSimpleSection(text, "Customer Company");
}

function parseCustomerContactFromNote(text) {
  const section = parseSimpleSection(text, "Customer Contact");
  if (!section) {
    return {
      fullName: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    };
  }

  const lines = String(section)
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);

  const fullName = clean(lines[0] || "");
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  return {
    fullName,
    firstName: nameParts[0] || "",
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
    phone: parseLatestValue(section, "Phone"),
    email: parseLatestValue(section, "Email"),
  };
}

function parseCustomerAddressFromNote(text) {
  const section = parseSimpleSection(text, "Customer Address");
  if (!section) {
    return {
      address: "",
      city: "",
      state: "",
      zip: "",
    };
  }

  const lines = String(section)
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);

  const address = clean(lines[0] || "");
  const cityStateZip = clean(lines[1] || "");
  const cityStateZipMatch = cityStateZip.match(/^(.*?)(?:,\s*([A-Za-z]{2}))?(?:,\s*(\d{4,10}(?:-\d{4})?))?$/);

  return {
    address,
    city: clean(cityStateZipMatch?.[1] || ""),
    state: clean(cityStateZipMatch?.[2] || ""),
    zip: clean(cityStateZipMatch?.[3] || ""),
  };
}

function buildFallbackPhotoEntriesFromUrls(urls) {
  return (Array.isArray(urls) ? urls : [])
    .map((url, index) => {
      const cleanUrl = clean(url);
      if (!cleanUrl) return null;
      return {
        id: `field-photo-${index + 1}`,
        measurementNumber: String(index + 1),
        name: `Reference Photo ${index + 1}`,
        width: "",
        widthUnit: "in",
        height: "",
        heightUnit: "in",
        quantity: "",
        markupNotes: "",
        photoUrl: cleanUrl,
      };
    })
    .filter(Boolean);
}

function parseMeasurementEntriesFromNote(text) {
  const all = String(text || "");
  const fieldSections = [
    ...all.matchAll(
      /Field Measurements:\n([\s\S]*?)(?=\n\n(?:Field Update\s*\(|Products:|Line Items:|Location Type:|Surface:|Install Needed:|Mockup:|Customer Notes:|Field Photos \/ Measurements:|Uploaded Artwork \/ Files:|-----\n)|$)/gim
    ),
  ];

  const mergedByKey = new Map();

  fieldSections.forEach((sectionMatch) => {
    const section = clean(sectionMatch[1]);
    if (!section) return;

    const blocks = section.split(/\n\n(?=Measurement\s+\d+)/g);

    blocks.forEach((block, blockIndex) => {
      const numberMatch = block.match(/Measurement\s+(\d+)/i);
      const measurementNumber = clean(numberMatch?.[1] || String(blockIndex + 1));
      const widthMatch = block.match(/^Width:\s*(.+?)\s+(in|ft)$/im) || [];
      const heightMatch = block.match(/^Height:\s*(.+?)\s+(in|ft)$/im) || [];
      const name = parseLatestValue(block, "Location Label") || `Measurement ${measurementNumber}`;
      const key = `${measurementNumber}::${name.toLowerCase()}`;

      mergedByKey.set(key, {
        id: `measurement-${measurementNumber}`,
        measurementNumber,
        name,
        width: clean(widthMatch[1] || ""),
        widthUnit: clean(widthMatch[2] || "in"),
        height: clean(heightMatch[1] || ""),
        heightUnit: clean(heightMatch[2] || "in"),
        quantity: parseLatestValue(block, "Quantity"),
        markupNotes: parseLatestValue(block, "Markup Notes"),
        photoUrl: parseLatestValue(block, "Photo URL"),
      });
    });
  });

  return Array.from(mergedByKey.values()).sort((a, b) => {
    return Number(a.measurementNumber || 0) - Number(b.measurementNumber || 0);
  });
}

function parseMeasurementDataFromProductionNote(text) {
  const fullText = String(text || "");
  const contactFromNote = parseCustomerContactFromNote(fullText);
  const addressFromNote = parseCustomerAddressFromNote(fullText);
  const companyFromNote = parseCustomerCompanyFromNote(fullText);

  const fallbackFullName =
    clean(
      (fullText.match(/^Customer:\s*(.+)$/im) || [])[1] ||
      (fullText.match(/^Contact:\s*(.+)$/im) || [])[1]
    );
  const fallbackNameParts = fallbackFullName.split(/\s+/).filter(Boolean);

  const measurementPhotoEntries = parseMeasurementEntriesFromNote(fullText);
  const standalonePhotoUrls = parseUrlSection(fullText, "Field Photos / Measurements");
  const mergedPhotoUrls = Array.from(
    new Set(
      [
        ...measurementPhotoEntries.map((entry) => clean(entry?.photoUrl)).filter(Boolean),
        ...standalonePhotoUrls.map((url) => clean(url)).filter(Boolean),
      ]
    )
  );

  const measurementPhotoUrlSet = new Set(
    measurementPhotoEntries.map((entry) => clean(entry?.photoUrl)).filter(Boolean)
  );

  const fallbackPhotoEntries = buildFallbackPhotoEntriesFromUrls(
    mergedPhotoUrls.filter((url) => !measurementPhotoUrlSet.has(clean(url)))
  );

  const photoEntries = [...measurementPhotoEntries, ...fallbackPhotoEntries];

  return {
    firstName: contactFromNote.firstName || fallbackNameParts[0] || "",
    lastName:
      contactFromNote.lastName ||
      (fallbackNameParts.length > 1 ? fallbackNameParts.slice(1).join(" ") : ""),
    fullName: contactFromNote.fullName || fallbackFullName || "",
    company: companyFromNote || "",
    phone: contactFromNote.phone || "",
    email: contactFromNote.email || "",
    address: addressFromNote.address || "",
    city: addressFromNote.city || "",
    state: addressFromNote.state || "",
    zip: addressFromNote.zip || "",
    installNeeded: parseInstallNeededFromNote(fullText),
    installSameAsCustomer: parseInstallSameAddressFromNote(fullText),
    installAddress: parseSimpleSection(fullText, "Install Address"),
    colorNotes: parseSimpleSection(fullText, "Specific colors to use or match"),
    mockupInstructions: parseSimpleSection(fullText, "Mockup"),
    additionalInquiries: parseSimpleSection(fullText, "Customer Notes"),
    photoEntries,
    uploadedPhotoUrls: mergedPhotoUrls,
  };
}

function parseUrlSection(text, label) {
  const section = parseSimpleSection(text, label);
  if (!section) return [];

  return section
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);
}

function parseProductsFromNote(text) {
  const section = parseSimpleSection(text, "Products");
  if (!section) return [];

  return section
    .split(/\n|,/)
    .map((item) => clean(item))
    .filter(Boolean);
}

function parseStructuredLineItemDescription(description) {
  const parts = String(description || "")
    .split("|")
    .map((part) => clean(part))
    .filter(Boolean);

  const parsed = {
    category: "",
    description: "",
    finish: "",
    otherDetails: "",
  };

  const descriptionLines = [];

  parts.forEach((part) => {
    if (/^Category:/i.test(part)) {
      parsed.category = clean(part.replace(/^Category:/i, ""));
      return;
    }

    if (/^Finish:/i.test(part)) {
      parsed.finish = clean(part.replace(/^Finish:/i, ""));
      return;
    }

    if (/^Details:/i.test(part)) {
      parsed.otherDetails = clean(part.replace(/^Details:/i, ""));
      return;
    }

    descriptionLines.push(part);
  });

  parsed.description = descriptionLines.join(" | ");
  return parsed;
}

function mapPrintavoLineItems(groups, productionNote = "") {
  if (!Array.isArray(groups)) return [];

  const flattened = [];
  const parsedProductionNote = productionNote
    ? parseMeasurementDataFromProductionNote(productionNote)
    : { uploadedPhotoUrls: [] };
  const fallbackUploadedUrls = Array.isArray(parsedProductionNote?.uploadedPhotoUrls)
    ? parsedProductionNote.uploadedPhotoUrls.map((url) => clean(url)).filter(Boolean)
    : [];

  groups.forEach((group, groupIndex) => {
    const items =
      Array.isArray(group?.lineItems?.nodes) ? group.lineItems.nodes : [];
    const imprints =
      Array.isArray(group?.imprints?.nodes) ? group.imprints.nodes : [];

    const preferredImprint =
      imprints.find((imprint) => {
        const mockups =
          Array.isArray(imprint?.mockups?.nodes) ? imprint.mockups.nodes : [];
        return mockups.some((mockup) =>
          clean(mockup?.fullImageUrl || mockup?.thumbnailUrl)
        );
      }) || null;

    const preferredMockup = preferredImprint
      ? (Array.isArray(preferredImprint?.mockups?.nodes)
          ? preferredImprint.mockups.nodes
          : []
        ).find((mockup) => clean(mockup?.fullImageUrl || mockup?.thumbnailUrl)) || null
      : null;

    const imprintDetails = preferredImprint ? clean(preferredImprint.details) : "";

    items.forEach((item, itemIndex) => {
      const sizes = Array.isArray(item?.sizes) ? item.sizes : [];
      const primarySize = sizes[0] || null;
      const parsedDescription = parseStructuredLineItemDescription(item?.description || "");
      let imageUrl = preferredMockup
        ? clean(preferredMockup.fullImageUrl || preferredMockup.thumbnailUrl || "")
        : "";

      if (!imageUrl && fallbackUploadedUrls.length) {
        imageUrl =
          fallbackUploadedUrls[flattened.length] ||
          fallbackUploadedUrls[itemIndex] ||
          fallbackUploadedUrls[0] ||
          "";
      }

      flattened.push({
        id: item?.id || `line-item-${groupIndex + 1}-${itemIndex + 1}`,
        itemNumber: item?.itemNumber || String(flattened.length + 1),
        category:
          parsedDescription.category ||
          (item?.itemNumber
            ? `Line Item ${item.itemNumber}`
            : `Line Item ${flattened.length + 1}`),
        quantity:
          primarySize && Number.isFinite(Number(primarySize.count))
            ? Number(primarySize.count)
            : 1,
        color: item?.color || "",
        description: parsedDescription.description || "",
        finish: parsedDescription.finish || "",
        otherDetails: parsedDescription.otherDetails || imprintDetails || "",
        sizeLabel: primarySize?.size || "",
        imageUrl,
      });
    });
  });

  return flattened;
}

function buildMeasurementOnlyAppendBlock(form, existingNote = "") {
  const stamp = new Date().toLocaleString();
  const parsed = parseMeasurementDataFromProductionNote(existingNote || "");
  const previousMeasurements = Array.isArray(parsed.photoEntries) ? parsed.photoEntries : [];
  const currentMeasurements = Array.isArray(form.photoEntries) ? form.photoEntries : [];
  const uploadedPhotoUrls = Array.isArray(form.uploadedPhotoUrls) ? form.uploadedPhotoUrls : [];
  const sections = [];

  const previousByKey = new Map();
  previousMeasurements.forEach((entry, index) => {
    const key = `${index + 1}::${clean(entry?.name).toLowerCase()}`;
    previousByKey.set(key, entry);
  });

  const measurementBlocks = [];
  currentMeasurements.forEach((entry, index) => {
    const currentName = clean(entry?.name);
    const previous =
      previousByKey.get(`${index + 1}::${currentName.toLowerCase()}`) ||
      previousMeasurements[index] ||
      {};

    const lines = [];
    const isNewMeasurement =
      !clean(previous?.name) &&
      !clean(previous?.width) &&
      !clean(previous?.height) &&
      !clean(previous?.quantity) &&
      !clean(previous?.markupNotes) &&
      !clean(previous?.photoUrl);

    const currentWidth = clean(entry?.width)
      ? `${clean(entry.width)} ${clean(entry?.widthUnit || "in")}`
      : "";
    const previousWidth = clean(previous?.width)
      ? `${clean(previous.width)} ${clean(previous?.widthUnit || "in")}`
      : "";

    const currentHeight = clean(entry?.height)
      ? `${clean(entry.height)} ${clean(entry?.heightUnit || "in")}`
      : "";
    const previousHeight = clean(previous?.height)
      ? `${clean(previous.height)} ${clean(previous?.heightUnit || "in")}`
      : "";

    const currentQty = clean(entry?.quantity);
    const previousQty = clean(previous?.quantity);

    const currentNotes = clean(entry?.markupNotes);
    const previousNotes = clean(previous?.markupNotes);

    const currentPhotoUrl = clean(uploadedPhotoUrls[index]);
    const previousPhotoUrl = clean(previous?.photoUrl);

    if (isNewMeasurement || (currentName && currentName !== clean(previous?.name))) {
      if (currentName) lines.push(`Location Label: ${currentName}`);
    }

    if (isNewMeasurement || (currentWidth && currentWidth !== previousWidth)) {
      if (currentWidth) lines.push(`Width: ${currentWidth}`);
    }

    if (isNewMeasurement || (currentHeight && currentHeight !== previousHeight)) {
      if (currentHeight) lines.push(`Height: ${currentHeight}`);
    }

    if (isNewMeasurement || (currentQty && currentQty !== previousQty)) {
      if (currentQty) lines.push(`Quantity: ${currentQty}`);
    }

    if (isNewMeasurement || (currentNotes && currentNotes !== previousNotes)) {
      if (currentNotes) lines.push(`Markup Notes: ${currentNotes}`);
    }

    if (currentPhotoUrl && (isNewMeasurement || currentPhotoUrl !== previousPhotoUrl)) {
      lines.push(`Photo URL: ${currentPhotoUrl}`);
    }

    if (lines.length) {
      measurementBlocks.push(`Measurement ${index + 1}\n${lines.join("\n")}`);
    }
  });

  if (measurementBlocks.length) {
    sections.push(`-----\nField Measurements:\n${measurementBlocks.join("\n\n")}`);
  }

  if (clean(form.company) && !valuesEqual(form.company, parsed.company)) {
    sections.push(`-----\nCustomer Company:\n${clean(form.company)}`);
  }

  const currentFullName = [clean(form.firstName), clean(form.lastName)].filter(Boolean).join(" ");
  const previousFullName = [clean(parsed.firstName), clean(parsed.lastName)].filter(Boolean).join(" ");
  const contactChanged =
    (currentFullName && !valuesEqual(currentFullName, previousFullName)) ||
    (clean(form.phone) && !valuesEqual(form.phone, parsed.phone)) ||
    (clean(form.email) && !valuesEqual(form.email, parsed.email));

  if (contactChanged) {
    sections.push(
      `-----\nCustomer Contact:\n${currentFullName}\nPhone: ${clean(form.phone)}\nEmail: ${clean(form.email)}`
    );
  }

  const addressChanged =
    (clean(form.address) && !valuesEqual(form.address, parsed.address)) ||
    (clean(form.city) && !valuesEqual(form.city, parsed.city)) ||
    (clean(form.state) && !valuesEqual(form.state, parsed.state)) ||
    (clean(form.zip) && !valuesEqual(form.zip, parsed.zip));

  if (addressChanged) {
    sections.push(
      `-----\nCustomer Address:\n${clean(form.address)}\n${[clean(form.city), clean(form.state), clean(form.zip)].filter(Boolean).join(", ")}`
    );
  }

  if (clean(form.additionalInquiries) && !valuesEqual(form.additionalInquiries, parsed.additionalInquiries)) {
    sections.push(`-----\nCustomer Notes:\n${clean(form.additionalInquiries)}`);
  }

  if (clean(form.colorNotes) && !valuesEqual(form.colorNotes, parsed.colorNotes)) {
    sections.push(`-----\nSpecific colors to use or match:\n${clean(form.colorNotes)}`);
  }

  if (clean(form.mockupInstructions) && !valuesEqual(form.mockupInstructions, parsed.mockupInstructions)) {
    sections.push(`-----\nMockup:\n${clean(form.mockupInstructions)}`);
  }

  if (!sections.length) return "";
  return [`Field Update (${stamp})`, ...sections].join("\n\n");
}

/* =========================
   PRODUCTION NOTE BUILDER
========================= */
function buildProductionNote(form) {
  const lines = [];

  if (form.productTypes?.length) {
    lines.push(`Products: ${form.productTypes.join(", ")}`);
  }

  if (form.lineItems?.length) {
    const items = form.lineItems
      .map((item, i) => {
        return [
          `Item ${i + 1}`,
          `Category: ${item.category}`,
          `Qty: ${item.quantity}`,
          `Color: ${item.color}`,
          `Description: ${item.description}`,
          item.finish ? `Finish: ${item.finish}` : null,
          item.otherDetails ? `Details: ${item.otherDetails}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
      })
      .join("\n");

    lines.push(`Line Items:\n${items}`);
  }

  if (form.mockupInstructions) {
    lines.push(`Mockup:\n${form.mockupInstructions}`);
  }

  if (form.additionalInquiries) {
    lines.push(`Customer Notes:\n${form.additionalInquiries}`);
  }

  const uploadedPhotoBlock = appendUrlBlock(
    "Field Photos / Measurements",
    form.uploadedPhotoUrls
  );
  if (uploadedPhotoBlock) {
    lines.push(uploadedPhotoBlock);
  }

  const uploadedProductionFileBlock = appendUrlBlock(
    "Uploaded Artwork / Files",
    form.uploadedProductionFileUrls
  );
  if (uploadedProductionFileBlock) {
    lines.push(uploadedProductionFileBlock);
  }

  return lines.join("\n\n");
}

function buildQuoteUpdateAppendBlock(form) {
  const sections = [];
  const stamp = new Date().toLocaleString();

  sections.push(`Field Update (${stamp})`);
  // Persist customer core fields (so hydration survives refresh)
  if (form.company) {
    sections.push(`Customer Company:\n${form.company}`);
  }

  if (form.firstName || form.lastName || form.phone || form.email) {
    sections.push(`Customer Contact:\n${[form.firstName, form.lastName].filter(Boolean).join(" ")}\nPhone: ${form.phone || ""}\nEmail: ${form.email || ""}`);
  }

  if (form.address || form.city || form.state || form.zip) {
    sections.push(`Customer Address:\n${form.address || ""}\n${[form.city, form.state, form.zip].filter(Boolean).join(", ")}`);
  }


  // Products
  if (form.productTypes?.length) {
    sections.push(`Products:\n${form.productTypes.join("\n")}`);
  }

  // Line Items (FULL MULTI-LINE FORMAT)
  if (form.lineItems?.length) {
    const items = form.lineItems
      .map((item, i) => {
        return [
          `Item ${i + 1}`,
          item.category ? `Category: ${item.category}` : null,
          item.quantity ? `Qty: ${item.quantity}` : null,
          item.color ? `Color: ${item.color}` : null,
          item.description ? `Description: ${item.description}` : null,
          item.finish ? `Finish: ${item.finish}` : null,
          item.otherDetails ? `Details: ${item.otherDetails}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    sections.push(`Line Items:\n${items}`);
  }

  if (form.locationType) {
    sections.push(`Location Type:\n${form.locationType}`);
  }

  if (form.surfaceType || form.surfaceOther) {
    sections.push(
      `Surface:\n${[form.surfaceType, form.surfaceOther]
        .filter(Boolean)
        .join("\n")}`
    );
  }

  if (form.installNeeded === true) {
    sections.push(`Install Needed:\nYes`);
  }

  if (form.mockupInstructions) {
    sections.push(`Mockup:\n${form.mockupInstructions}`);
  }

  if (form.additionalInquiries) {
    sections.push(`Customer Notes:\n${form.additionalInquiries}`);
  }

  // Uploaded Photos (each on its own line)
  if (Array.isArray(form.uploadedPhotoUrls) && form.uploadedPhotoUrls.length) {
    sections.push(
      `Field Photos / Measurements:\n${form.uploadedPhotoUrls.join("\n")}`
    );
  }

  // Uploaded Files
  if (
    Array.isArray(form.uploadedProductionFileUrls) &&
    form.uploadedProductionFileUrls.length
  ) {
    sections.push(
      `Uploaded Artwork / Files:\n${form.uploadedProductionFileUrls.join("\n")}`
    );
  }

  return sections.filter(Boolean).join("\n\n");
}

/* =========================
   GRAPHQL WRAPPER
========================= */
async function printavoRequest(query, variables = {}) {
  const res = await fetch(PRINTAVO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: process.env.PRINTAVO_EMAIL,
      token: process.env.PRINTAVO_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non JSON response: ${text}`);
  }

  if (!res.ok || data.errors) {
    throw new Error(data?.errors?.[0]?.message || "Printavo error");
  }

  return data.data;
}

/* =========================
   CONTACT
========================= */
async function findContact(email) {
  const safeEmail = clean(email);
  if (!safeEmail) return null;

  const query = `
    query ($query: String!) {
      contacts(query: $query, first: 5) {
        nodes { id email }
      }
    }
  `;

  const data = await printavoRequest(query, { query: safeEmail });
  return data?.contacts?.nodes?.[0] || null;
}

/* =========================
   CREATE CUSTOMER
========================= */
async function createCustomer(form) {
  const mutation = `
    mutation ($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        primaryContact { id }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    input: {
      companyName: clean(form.company) || buildContactName(form) || "Customer",
      primaryContact: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      },
    },
  });

  return data.customerCreate.primaryContact;
}

/* =========================
   CREATE QUOTE
========================= */
async function createQuote(form, contactId) {
  const mutation = `
    mutation ($input: QuoteCreateInput!) {
      quoteCreate(input: $input) {
        id
        visualId
        publicUrl
        productionNote
        lineItemGroups(first: 8) {
          nodes {
            id
            lineItems(first: 100) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  `;

  const lineItemGroups = buildLineItemGroupCreateInput(form);

  const data = await printavoRequest(mutation, {
    input: {
      contact: { id: contactId },
      nickname: buildNickname(form),
      productionNote: buildProductionNote(form),
      invoiceAt: todayDate(),
      customerDueAt: tomorrowDate(),
      dueAt: nextWeekDateTime(),
      lineItemGroups: lineItemGroups.length ? lineItemGroups : undefined,
    },
  });

  return data.quoteCreate;
}

async function submitPrintavoInquiry(form) {
  const name =
    clean(form?.name) ||
    [clean(form?.firstName), clean(form?.lastName)].filter(Boolean).join(" ");
  const email = clean(form?.email);
  const phone = clean(form?.phone);
  const inquiry = clean(form?.inquiry);

  if (!name) {
    throw new Error("Inquiry name is required.");
  }

  if (!email) {
    throw new Error("Inquiry email is required.");
  }

  if (!phone) {
    throw new Error("Inquiry phone is required.");
  }

  if (!inquiry) {
    throw new Error("Inquiry details are required.");
  }

  if (!PRINTAVO_INQUIRY_KEY) {
    throw new Error("PRINTAVO_INQUIRY_KEY is missing on the server.");
  }

  const body = new URLSearchParams({
    key: PRINTAVO_INQUIRY_KEY,
    c_name: name,
    c_email: email,
    c_phone: phone,
    c_inquiry: inquiry,
  });

  const response = await fetch(PRINTAVO_INQUIRY_FORM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Printavo inquiry form error: ${response.status} ${responseText}`
    );
  }

  return {
    ok: true,
    status: response.status,
    responseText,
  };
}

/* =========================
   QUOTE LINE ITEMS
========================= */
async function getQuoteLineItemGroups(quoteId) {
  const query = `
    query ($id: ID!) {
      quote(id: $id) {
        id
        lineItemGroups(first: 8) {
          nodes {
            id
            position
            lineItems(first: 100) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(quoteId) });
  return data?.quote?.lineItemGroups?.nodes || [];
}

async function getQuoteDetails(quoteId) {
  const query = `
    query ($id: ID!) {
      quote(id: $id) {
        id
        visualId
        nickname
        productionNote
        publicUrl
        status {
          id
          name
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(quoteId) });
  return data?.quote || null;
}

async function deleteLineItems(ids) {
  if (!Array.isArray(ids) || !ids.length) return;

  const mutation = `
    mutation ($ids: [ID!]!) {
      lineItemDeletes(ids: $ids) {
        id
      }
    }
  `;

  await printavoRequest(mutation, { ids: ids.map((id) => String(id)) });
}

async function createLineItemGroup(parentId, input) {
  const mutation = `
    mutation ($parentId: ID!, $input: LineItemGroupCreateInput!) {
      lineItemGroupCreate(parentId: $parentId, input: $input) {
        id
        lineItems(first: 100) {
          nodes {
            id
          }
        }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    parentId: String(parentId),
    input,
  });

  return data?.lineItemGroupCreate || null;
}

async function createLineItemsOnGroup(lineItemGroupId, form) {
  const normalized = normalizeLineItems(form);
  if (!normalized.length) return [];

  const mutation = `
    mutation ($inputs: [LineItemCreatesInput!]!) {
      lineItemCreates(inputs: $inputs) {
        id
      }
    }
  `;

  const inputs = normalized.map((item, index) => ({
    lineItemGroupId: String(lineItemGroupId),
    input: buildLineItemCreateInput(item, index),
  }));

  const data = await printavoRequest(mutation, { inputs });
  return data?.lineItemCreates || [];
}

async function syncQuoteLineItems(
  quoteId,
  form,
  existingGroupsFromQuote = null
) {
  const normalized = normalizeLineItems(form);
  const existingGroups =
    existingGroupsFromQuote || (await getQuoteLineItemGroups(quoteId));

  const existingLineItemIds = existingGroups.flatMap(
    (group) => group?.lineItems?.nodes?.map((item) => item.id) || []
  );

  if (existingLineItemIds.length) {
    await deleteLineItems(existingLineItemIds);
  }

  if (!normalized.length) {
    return { created: 0, lineItemGroupId: existingGroups?.[0]?.id || null };
  }

  let targetGroupId = existingGroups?.[0]?.id || null;

  if (!targetGroupId) {
    const createdGroup = await createLineItemGroup(quoteId, {
      position: 1,
      lineItems: [],
    });
    targetGroupId = createdGroup?.id || null;
  }

  if (!targetGroupId) {
    throw new Error("Could not find or create a Printavo line item group.");
  }

  const created = await createLineItemsOnGroup(targetGroupId, form);
  return {
    created: created.length,
    lineItemGroupId: targetGroupId,
  };
}

/* =========================
   UPDATE QUOTE
========================= */
async function updateQuote(form, quoteId) {
  const currentQuote = await getQuoteDetails(quoteId);
  const appendBlock = form.measurementOnly
    ? buildMeasurementOnlyAppendBlock(form, currentQuote?.productionNote || "")
    : buildQuoteUpdateAppendBlock(form);
  const currentProductionNote = clean(currentQuote?.productionNote);
  const nextProductionNote = appendBlock
    ? currentProductionNote
      ? `${currentProductionNote}\n\n${appendBlock}`
      : appendBlock
    : currentProductionNote;

  const mutation = `
    mutation ($id: ID!, $input: QuoteInput!) {
      quoteUpdate(id: $id, input: $input) {
        id
        visualId
        publicUrl
        productionNote
        lineItemGroups(first: 8) {
          nodes {
            id
            lineItems(first: 100) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    id: quoteId,
    input: {
      nickname: form.measurementOnly
        ? clean(currentQuote?.nickname) || buildNickname(form)
        : buildNickname(form),
      productionNote: nextProductionNote,
      ...(clean(form.address) || clean(form.city) || clean(form.state) || clean(form.zip)
        ? {
            billingAddress: {
              address1: clean(form.address),
              city: clean(form.city),
              stateIso: clean(form.state),
              zipCode: clean(form.zip),
            },
          }
        : {}),
    },
  });

  return data.quoteUpdate;
}

async function updateQuoteStatus(quoteId, statusId) {
  const mutation = `
    mutation ($parentId: ID!, $statusId: ID!) {
      statusUpdate(parentId: $parentId, statusId: $statusId) {
        ... on Quote {
          id
          visualId
          status {
            id
            name
          }
        }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    parentId: String(quoteId),
    statusId: String(statusId),
  });

  return data?.statusUpdate || null;
}

/* =========================
   JOB FETCHERS
========================= */
async function fetchMeasurementQuotes() {
  const query = `
    query ($statusIds: [ID!]) {
      quotes(statusIds: $statusIds, first: 25) {
        nodes {
          id
          visualId
          nickname
          contact {
            fullName
            phone
            email
          }
          billingAddress {
            address1
            city
            stateIso
            zipCode
            companyName
          }
          productionNote
          status {
            id
            name
          }
        }
      }
    }
  `;

  const data = await printavoRequest(query, {
    statusIds: [MEASUREMENT_STATUS_ID],
  });

  const quotes = Array.isArray(data?.quotes?.nodes) ? data.quotes.nodes : [];

  return quotes.map((q) => {
    const parsed = parseMeasurementDataFromProductionNote(q.productionNote || "");
    const fullName = clean(q.contact?.fullName || "");
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    return {
      id: `PRINTAVO-${q.id}`,
      printavoOrderType: "Quote",
      printavoQuoteId: String(q.id),
      invoiceNumber: q.visualId,
      printavoQuoteNumber: q.visualId,
      nickname: q.nickname || "",
      customer:
        parsed.fullName ||
        q.contact?.fullName ||
        parsed.company ||
        q.billingAddress?.companyName ||
        "",
      contact: parsed.fullName || q.contact?.fullName || "",
      firstName: parsed.firstName || nameParts[0] || "",
      lastName:
        parsed.lastName ||
        (nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""),
      company: parsed.company || q.billingAddress?.companyName || "",
      phone: parsed.phone || q.contact?.phone || "",
      email: parsed.email || q.contact?.email || "",
      address: parsed.address || q.billingAddress?.address1 || "",
      city: parsed.city || q.billingAddress?.city || "",
      state: parsed.state || q.billingAddress?.stateIso || "",
      zip: parsed.zip || q.billingAddress?.zipCode || "",
      mockup: q.productionNote || "",
      lineItems: [],
      artworkReferenceImages: [],
      photoEntries: parsed.photoEntries || [],
      uploadedPhotoUrls: parsed.uploadedPhotoUrls || [],
      installNeeded: typeof parsed.installNeeded === "boolean" ? parsed.installNeeded : false,
      installSameAsCustomer: typeof parsed.installSameAsCustomer === "boolean" ? parsed.installSameAsCustomer : true,
      installAddress: parsed.installAddress || "",
      colorNotes: parsed.colorNotes || "",
      mockupInstructions: parsed.mockupInstructions || "",
      additionalInquiries: parsed.additionalInquiries || "",
      status: q.status?.name || "",
      statusId: q.status?.id ? String(q.status.id) : "",
    };
  });
}

async function fetchInstallInvoices() {
  const query = `
    query ($statusIds: [ID!]) {
      invoices(statusIds: $statusIds, first: 25) {
        nodes {
          id
          visualId
          nickname
          contact {
            fullName
            phone
            email
          }
          billingAddress {
            address1
            city
            stateIso
            zipCode
            companyName
          }
          productionNote
          status {
            id
            name
          }
        }
      }
    }
  `;

  const data = await printavoRequest(query, {
    statusIds: [INSTALL_READY_STATUS_ID],
  });

  return (data?.invoices?.nodes || []).map((inv) => ({
    id: `PRINTAVO-${inv.id}`,
    printavoOrderType: "Invoice",
    printavoQuoteId: String(inv.id),
    invoiceNumber: inv.visualId,
    printavoQuoteNumber: inv.visualId,
    nickname: inv.nickname || "",
    customer: inv.contact?.fullName || inv.billingAddress?.companyName || "",
    contact: inv.contact?.fullName || "",
    phone: inv.contact?.phone || "",
    email: inv.contact?.email || "",
    address: inv.billingAddress?.address1 || "",
    city: inv.billingAddress?.city || "",
    state: inv.billingAddress?.stateIso || "",
    zip: inv.billingAddress?.zipCode || "",
    mockup: inv.productionNote || "",
    status: inv.status?.name || "",
    statusId: inv.status?.id ? String(inv.status.id) : "",
  }));
}

async function fetchLineItemsForGroup(lineItemGroupId) {
  const query = `
    query ($id: ID!) {
      lineItemGroup(id: $id) {
        id
        position
        lineItems(first: 10) {
          nodes {
            id
            itemNumber
            color
            description
            sizes {
              count
              size
            }
          }
        }
        imprints(first: 10) {
          nodes {
            id
            details
            mockups(first: 1) {
              nodes {
                thumbnailUrl
                fullImageUrl
              }
            }
          }
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(lineItemGroupId) });
  const group = data?.lineItemGroup || null;

  return group;
}

async function fetchDetailedGroupsSafely(groupNodes, maxGroups = 3) {
  const safeGroups = Array.isArray(groupNodes) ? groupNodes.slice(0, maxGroups) : [];
  const detailedGroups = [];

  for (const group of safeGroups) {
    try {
      const detailedGroup = await fetchLineItemsForGroup(group.id);
      if (detailedGroup) detailedGroups.push(detailedGroup);
    } catch (error) {
      console.error("Skipping Printavo line item group fetch:", group?.id, error?.message || error);
    }
  }

  return detailedGroups;
}

function mapInvoiceLineItems(groups) {
  return mapPrintavoLineItems(groups);
}

function unused_old_mapInvoiceLineItems(groups) {
  if (!Array.isArray(groups)) return [];

  const flattened = [];

  groups.forEach((group, groupIndex) => {
    const items =
      Array.isArray(group?.lineItems?.nodes) ? group.lineItems.nodes : [];
    const imprints =
      Array.isArray(group?.imprints?.nodes) ? group.imprints.nodes : [];

    const preferredImprint =
      imprints.find((imprint) => {
        const mockups =
          Array.isArray(imprint?.mockups?.nodes) ? imprint.mockups.nodes : [];
        return mockups.some((mockup) =>
          clean(mockup?.fullImageUrl || mockup?.thumbnailUrl)
        );
      }) || null;

    const preferredMockup = preferredImprint
      ? (Array.isArray(preferredImprint?.mockups?.nodes)
          ? preferredImprint.mockups.nodes
          : []
        ).find((mockup) => clean(mockup?.fullImageUrl || mockup?.thumbnailUrl)) || null
      : null;

    const imageUrl = preferredMockup
      ? clean(preferredMockup.fullImageUrl || preferredMockup.thumbnailUrl || "")
      : "";

    const imprintDetails = preferredImprint ? clean(preferredImprint.details) : "";

    items.forEach((item, itemIndex) => {
      const sizes = Array.isArray(item?.sizes) ? item.sizes : [];
      const primarySize = sizes[0] || null;

      flattened.push({
        id: item?.id || `invoice-line-${groupIndex + 1}-${itemIndex + 1}`,
        itemNumber: item?.itemNumber || String(flattened.length + 1),
        category: item?.itemNumber
          ? `Line Item ${item.itemNumber}`
          : `Line Item ${flattened.length + 1}`,
        quantity:
          primarySize && Number.isFinite(Number(primarySize.count))
            ? Number(primarySize.count)
            : 1,
        color: item?.color || "",
        description: item?.description || "",
        otherDetails: imprintDetails || "",
        sizeLabel: primarySize?.size || "",
        imageUrl,
      });
    });
  });

  return flattened;
}


async function getQuoteHistoryDetails(quoteId) {
  const query = `
    query ($id: ID!) {
      quote(id: $id) {
        id
        visualId
        nickname
        publicUrl
        productionNote
        contact {
          fullName
          phone
          email
        }
        billingAddress {
          address1
          city
          stateIso
          zipCode
          companyName
        }
        lineItemGroups(first: 25) {
          nodes {
            id
            position
          }
        }
        status {
          id
          name
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(quoteId) });
  const quote = data?.quote || null;
  if (!quote) return null;

  const groupNodes = Array.isArray(quote?.lineItemGroups?.nodes)
    ? quote.lineItemGroups.nodes
    : [];

  const detailedGroups = await fetchDetailedGroupsSafely(groupNodes);

  const productionNote = quote.productionNote || "";
  const parsedMeasurements = parseMeasurementDataFromProductionNote(productionNote);
  const productTypes = parseProductsFromNote(productionNote);
  const uploadedProductionFileUrls = parseUrlSection(
    productionNote,
    "Uploaded Artwork / Files"
  );

  const fullName = clean(quote.contact?.fullName || "");
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  return {
    id: `PRINTAVO-${quote.id}`,
    printavoOrderType: "Quote",
    printavoQuoteId: String(quote.id),
    invoiceNumber: quote.visualId,
    printavoQuoteNumber: quote.visualId,
    printavoPublicUrl: quote.publicUrl || "",
    nickname: quote.nickname || "",
    jobNickname: quote.nickname || "",
    customer: parsedMeasurements.fullName || quote.contact?.fullName || parsedMeasurements.company || quote.billingAddress?.companyName || "",
    contact: parsedMeasurements.fullName || quote.contact?.fullName || "",
    firstName: parsedMeasurements.firstName || nameParts[0] || "",
    lastName:
      parsedMeasurements.lastName ||
      (nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""),
    phone: parsedMeasurements.phone || quote.contact?.phone || "",
    email: parsedMeasurements.email || quote.contact?.email || "",
    company: parsedMeasurements.company || quote.billingAddress?.companyName || "",
    address: parsedMeasurements.address || quote.billingAddress?.address1 || "",
    city: parsedMeasurements.city || quote.billingAddress?.city || "",
    state: parsedMeasurements.state || quote.billingAddress?.stateIso || "",
    zip: parsedMeasurements.zip || quote.billingAddress?.zipCode || "",
    mockup: productionNote,
    productionNote,
    lineItems: mapPrintavoLineItems(detailedGroups, productionNote),
    productTypes,
    photoEntries: parsedMeasurements.photoEntries || [],
    uploadedPhotoUrls: parsedMeasurements.uploadedPhotoUrls || [],
    productionFiles: uploadedProductionFileUrls.map((url, index) => ({
      id: `production-file-${index + 1}`,
      name: `Artwork File ${index + 1}`,
      url,
      uploadedUrl: url,
      previewUrl: url,
      type: "",
      size: "",
    })),
    uploadedProductionFileUrls,
    installNeeded:
      typeof parsedMeasurements.installNeeded === "boolean"
        ? parsedMeasurements.installNeeded
        : false,
    installSameAsCustomer:
      typeof parsedMeasurements.installSameAsCustomer === "boolean"
        ? parsedMeasurements.installSameAsCustomer
        : true,
    installAddress: parsedMeasurements.installAddress || "",
    colorNotes: parsedMeasurements.colorNotes || "",
    mockupInstructions: parsedMeasurements.mockupInstructions || "",
    additionalInquiries: parsedMeasurements.additionalInquiries || "",
    locationType: parseSimpleSection(productionNote, "Location Type") || "",
    surfaceType: parseSimpleSection(productionNote, "Surface") || "",
    status: quote.status?.name || "",
    statusId: quote.status?.id ? String(quote.status.id) : "",
  };
}

async function getInvoiceInstallDetails(invoiceId) {
  const query = `
    query ($id: ID!) {
      invoice(id: $id) {
        id
        visualId
        nickname
        productionNote
        customerNote
        contact {
          fullName
          phone
          email
        }
        billingAddress {
          address1
          city
          stateIso
          zipCode
          companyName
        }
        lineItemGroups(first: 8) {
          nodes {
            id
            position
          }
        }
        status {
          id
          name
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(invoiceId) });
  const inv = data?.invoice || null;
  if (!inv) return null;

  const groupNodes = Array.isArray(inv?.lineItemGroups?.nodes)
    ? inv.lineItemGroups.nodes
    : [];

  const detailedGroups = await fetchDetailedGroupsSafely(groupNodes);

  return {
    id: `PRINTAVO-${inv.id}`,
    printavoOrderType: "Invoice",
    printavoQuoteId: String(inv.id),
    invoiceNumber: inv.visualId,
    printavoQuoteNumber: inv.visualId,
    nickname: inv.nickname || "",
    customer: inv.contact?.fullName || inv.billingAddress?.companyName || "",
    contact: inv.contact?.fullName || "",
    phone: inv.contact?.phone || "",
    email: inv.contact?.email || "",
    address: inv.billingAddress?.address1 || "",
    city: inv.billingAddress?.city || "",
    state: inv.billingAddress?.stateIso || "",
    zip: inv.billingAddress?.zipCode || "",
    mockup: inv.productionNote || "",
    productionNote: inv.productionNote || "",
    customerNote: inv.customerNote || "",
    lineItems: mapInvoiceLineItems(detailedGroups),
    status: inv.status?.name || "",
    statusId: inv.status?.id ? String(inv.status.id) : "",
  };
}

async function getInvoiceDetails(invoiceId) {
  const query = `
    query ($id: ID!) {
      invoice(id: $id) {
        id
        visualId
        productionNote
        customerNote
        status {
          id
          name
        }
      }
    }
  `;

  const data = await printavoRequest(query, { id: String(invoiceId) });
  return data?.invoice || null;
}

async function appendInvoiceProductionNote(invoiceId, noteAppend) {
  const appendText = clean(noteAppend);
  if (!appendText) return null;

  const invoice = await getInvoiceDetails(invoiceId);
  const currentNote = clean(invoice?.productionNote);
  const nextNote = currentNote ? `${currentNote}\n\n${appendText}` : appendText;

  const mutation = `
    mutation ($id: ID!, $input: InvoiceInput!) {
      invoiceUpdate(id: $id, input: $input) {
        id
        visualId
        productionNote
        status {
          id
          name
        }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    id: String(invoiceId),
    input: {
      productionNote: nextNote,
    },
  });

  return data?.invoiceUpdate || null;
}

app.post("/api/upload-images", upload.array("images", 20), (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const urls = files.map(
      (file) => `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
    );

    res.json({
      ok: true,
      urls,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/api/printavo/measurement-jobs", async (_req, res) => {
  try {
    const quoteJobs = await fetchMeasurementQuotes();

    res.json({
      ok: true,
      jobs: quoteJobs,
      debug: {
        quoteCount: quoteJobs.length,
        message: "Showing OFFSITE - MEASUREMENT quotes only.",
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/printavo/install-jobs", async (_req, res) => {
  try {
    const invoiceJobs = await fetchInstallInvoices();

    res.json({
      ok: true,
      jobs: invoiceJobs,
      debug: {
        invoiceCount: invoiceJobs.length,
        message: "Showing ORDER READY FOR INSTALL invoices only.",
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.get("/api/printavo/measurement-job-details/:quoteId", async (req, res) => {
  try {
    const quoteId = clean(req.params.quoteId);
    if (!quoteId) {
      return res.status(400).json({ ok: false, error: "Missing quoteId" });
    }

    const job = await getMeasurementJobDetails(quoteId);

    if (!job) {
      return res.status(404).json({ ok: false, error: "Measurement job not found." });
    }

    res.json({ ok: true, job });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/printavo/install-job-details/:invoiceId", async (req, res) => {
  try {
    const invoiceId = clean(req.params.invoiceId);
    if (!invoiceId) {
      return res.status(400).json({ ok: false, error: "Missing invoiceId" });
    }

    const job = await getInvoiceInstallDetails(invoiceId);

    if (!job) {
      return res.status(404).json({ ok: false, error: "Install job not found." });
    }

    res.json({ ok: true, job });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/printavo/history-details/:quoteId", async (req, res) => {
  try {
    const quoteId = clean(req.params.quoteId);
    if (!quoteId) {
      return res.status(400).json({ ok: false, error: "Missing quoteId" });
    }

    const order = await getQuoteHistoryDetails(quoteId);

    if (!order) {
      return res.status(404).json({ ok: false, error: "History order not found." });
    }

    res.json({ ok: true, order });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   UPDATE INVOICE STATUS
========================= */

async function updateInvoiceStatus(invoiceId, statusId) {
  const mutation = `
    mutation ($parentId: ID!, $statusId: ID!) {
      statusUpdate(parentId: $parentId, statusId: $statusId) {
        ... on Invoice {
          id
          visualId
          status {
            id
            name
          }
        }
      }
    }
  `;

  const data = await printavoRequest(mutation, {
    parentId: String(invoiceId),
    statusId: String(statusId),
  });

  return data?.statusUpdate || null;
}

app.post("/api/printavo/mark-installed", async (req, res) => {
  try {
    const { printavoQuoteId, statusId, installNoteAppend } = req.body;

    if (!printavoQuoteId) {
      return res.status(400).json({
        ok: false,
        error: "Missing printavoQuoteId",
      });
    }

    if (!statusId) {
      return res.status(400).json({
        ok: false,
        error: "Missing statusId",
      });
    }

    const updatedStatus = await updateInvoiceStatus(printavoQuoteId, statusId);

    let noteUpdate = null;
    let warning = "";

    if (clean(installNoteAppend)) {
      try {
        noteUpdate = await appendInvoiceProductionNote(
          printavoQuoteId,
          installNoteAppend
        );
      } catch (noteErr) {
        warning = `Status updated, but note append failed: ${noteErr.message}`;
      }
    }

    let message = "Status updated";

    if (statusId === INSTALLED_STATUS_ID) {
      message = "Marked as INSTALLED";
    } else if (statusId === INSTALL_ISSUE_STATUS_ID) {
      message = "Marked as INSTALL ISSUE";
    }

    res.json({
      ok: true,
      message,
      statusId,
      updated: noteUpdate || updatedStatus,
      statusUpdate: updatedStatus,
      noteUpdate,
      warning,
    });
  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/* =========================
   COMPLETE MEASUREMENT QUOTE
========================= */

app.post("/api/printavo/complete-measurement", async (req, res) => {
  try {
    const { printavoQuoteId } = req.body;

    if (!printavoQuoteId) {
      return res.status(400).json({
        ok: false,
        error: "Missing printavoQuoteId",
      });
    }

    const updated = await updateQuoteStatus(
      printavoQuoteId,
      MEASUREMENT_COMPLETE_STATUS_ID
    );

    res.json({
      ok: true,
      message: "Marked as OFFSITE - MEASUREMENT - COMPLETE",
      statusId: MEASUREMENT_COMPLETE_STATUS_ID,
      updated,
    });
  } catch (err) {
    console.error("Measurement Complete Status Update Error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.post("/api/printavo/inquiry", async (req, res) => {
  try {
    const result = await submitPrintavoInquiry(req.body || {});

    res.json({
      ok: true,
      message: "Inquiry submitted to Printavo.",
      submitted: result.ok,
      status: result.status,
    });
  } catch (err) {
    console.error("Printavo Inquiry Error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/* =========================
   MAIN SYNC
========================= */
app.post("/api/printavo/intake", async (req, res) => {
  try {
    const form = req.body || {};

    let contact = await findContact(form.email);
    if (!contact) contact = await createCustomer(form);

    let quote;

    if (form.printavoQuoteId) {
      quote = await updateQuote(form, form.printavoQuoteId);
    } else {
      quote = await createQuote(form, contact.id);
    }

    const isMeasurementOnly = !!form.measurementOnly;

    const lineItemSync = isMeasurementOnly
      ? {
          created: 0,
          lineItemGroupId: quote?.lineItemGroups?.nodes?.[0]?.id || null,
        }
      : await syncQuoteLineItems(
          quote.id,
          form,
          quote?.lineItemGroups?.nodes || null
        );

    res.json({
      ok: true,
      quoteId: quote.id,
      visualId: quote.visualId,
      publicUrl: quote.publicUrl,
      productionNote: quote.productionNote || "",
      lineItemsCreated: lineItemSync.created,
      lineItemGroupId: lineItemSync.lineItemGroupId,
      measurementOnly: isMeasurementOnly,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});


/* =========================
   PERSISTENT APP AUTH
========================= */
const authDataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(authDataDir)) {
  fs.mkdirSync(authDataDir, { recursive: true });
}

const authUsersFile = path.join(authDataDir, "app-users.json");
const authSessionsFile = path.join(authDataDir, "app-sessions.json");

const DEFAULT_APP_USERS = [
  {
    id: "bart-admin",
    username: "bart",
    password: "DecalMonkey!2026",
    displayName: "Bart",
    role: "admin",
    isActive: true,
  },
  {
    id: "heather-admin",
    username: "heather",
    password: "Heather!2026",
    displayName: "Heather",
    role: "admin",
    isActive: true,
  },
  {
    id: "installer-default",
    username: "installer",
    password: "Install!2026",
    displayName: "Installer",
    role: "installer",
    isActive: true,
  },
];

function safeReadJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function normalizeAppUser(user = {}, index = 0) {
  const role = clean(user?.role).toLowerCase();
  return {
    id: clean(user?.id) || `dm-user-${Date.now()}-${index}`,
    username: clean(user?.username),
    password: clean(user?.password),
    displayName: clean(user?.displayName),
    role:
      role === "admin" || role === "sales" || role === "installer" || role === "field"
        ? role
        : "sales",
    isActive: user?.isActive !== false,
  };
}

function normalizeAppSession(session = {}, index = 0) {
  return {
    id: clean(session?.id) || `dm-session-${Date.now()}-${index}`,
    sessionToken: clean(session?.sessionToken),
    userId: clean(session?.userId),
    username: clean(session?.username),
    displayName: clean(session?.displayName),
    role: clean(session?.role) || "sales",
    deviceName: clean(session?.deviceName) || "Unknown Device",
    createdAt: clean(session?.createdAt) || new Date().toISOString(),
    lastSeenAt: clean(session?.lastSeenAt) || new Date().toISOString(),
    isActive: session?.isActive !== false,
  };
}

function ensurePersistentAuthFiles() {
  if (!fs.existsSync(authUsersFile)) {
    safeWriteJsonFile(authUsersFile, DEFAULT_APP_USERS);
  }
  if (!fs.existsSync(authSessionsFile)) {
    safeWriteJsonFile(authSessionsFile, []);
  }
}

ensurePersistentAuthFiles();

function loadAppUsers() {
  return safeReadJsonFile(authUsersFile, DEFAULT_APP_USERS)
    .map((user, index) => normalizeAppUser(user, index))
    .filter((user) => user.username && user.password && user.displayName);
}

function saveAppUsers(users) {
  const sanitized = (Array.isArray(users) ? users : [])
    .map((user, index) => normalizeAppUser(user, index))
    .filter((user) => user.username && user.password && user.displayName);

  const deduped = sanitized.filter(
    (user, index) =>
      sanitized.findIndex(
        (candidate) =>
          clean(candidate.username).toLowerCase() === clean(user.username).toLowerCase()
      ) === index
  );

  safeWriteJsonFile(authUsersFile, deduped);
  return deduped;
}

function resetAppUsersToDefaults() {
  safeWriteJsonFile(authUsersFile, DEFAULT_APP_USERS);
  return loadAppUsers();
}

function loadAppSessions() {
  return safeReadJsonFile(authSessionsFile, [])
    .map((session, index) => normalizeAppSession(session, index))
    .filter((session) => session.sessionToken && session.userId);
}

function saveAppSessions(sessions) {
  const sanitized = (Array.isArray(sessions) ? sessions : [])
    .map((session, index) => normalizeAppSession(session, index))
    .filter((session) => session.sessionToken && session.userId);

  safeWriteJsonFile(authSessionsFile, sanitized);
  return sanitized;
}

function createSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function buildSessionUser(user, session) {
  return {
    ...normalizeAppUser(user),
    sessionToken: clean(session?.sessionToken),
    sessionId: clean(session?.id),
    deviceName: clean(session?.deviceName),
  };
}

app.get("/api/auth/users", (_req, res) => {
  try {
    res.json({
      ok: true,
      users: loadAppUsers(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/users", (req, res) => {
  try {
    const savedUsers = saveAppUsers(req.body?.users || []);
    res.json({
      ok: true,
      users: savedUsers,
      message: `Saved ${savedUsers.length} shared app login${savedUsers.length === 1 ? "" : "s"}.`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/users/reset", (_req, res) => {
  try {
    const users = resetAppUsersToDefaults();
    res.json({
      ok: true,
      users,
      message: "Shared app logins reset to the default Decal Monkey starter accounts.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const username = clean(req.body?.username).toLowerCase();
    const password = clean(req.body?.password);
    const deviceName = clean(req.body?.deviceName) || "Unknown Device";

    const users = loadAppUsers();
    const matchedUser = users.find(
      (user) =>
        user.isActive !== false &&
        clean(user.username).toLowerCase() === username &&
        clean(user.password) === password
    );

    if (!matchedUser) {
      return res.status(401).json({
        ok: false,
        error: "Incorrect username or password.",
      });
    }

    let sessions = loadAppSessions();
    sessions = sessions.filter(
      (session) => !(clean(session.userId) === clean(matchedUser.id) && clean(session.deviceName) === deviceName)
    );

    const session = normalizeAppSession({
      id: `dm-session-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      sessionToken: createSessionToken(),
      userId: matchedUser.id,
      username: matchedUser.username,
      displayName: matchedUser.displayName,
      role: matchedUser.role,
      deviceName,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isActive: true,
    });

    sessions.unshift(session);
    saveAppSessions(sessions);

    res.json({
      ok: true,
      user: buildSessionUser(matchedUser, session),
      message: "Login successful.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/change-password", (req, res) => {
  try {
    const sessionToken = clean(req.body?.sessionToken);
    const currentPassword = clean(req.body?.currentPassword);
    const newPassword = clean(req.body?.newPassword);

    if (!sessionToken) {
      return res.status(401).json({
        ok: false,
        error: "Missing session token.",
      });
    }

    if (!currentPassword) {
      return res.status(400).json({
        ok: false,
        error: "Enter your current password.",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        ok: false,
        error: "Enter a new password.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "New password must be at least 6 characters.",
      });
    }

    const session = loadAppSessions().find(
      (item) => clean(item.sessionToken) === sessionToken && item.isActive !== false
    );

    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "Your session expired. Please log in again.",
      });
    }

    const users = loadAppUsers();
    const matchedUser = users.find(
      (item) => clean(item.id) === clean(session.userId) && item.isActive !== false
    );

    if (!matchedUser) {
      return res.status(404).json({
        ok: false,
        error: "User not found.",
      });
    }

    if (clean(matchedUser.password) !== currentPassword) {
      return res.status(401).json({
        ok: false,
        error: "Current password is incorrect.",
      });
    }

    const nextUsers = users.map((item) =>
      clean(item.id) === clean(matchedUser.id)
        ? normalizeAppUser({
            ...item,
            password: newPassword,
          })
        : item
    );

    const savedUsers = saveAppUsers(nextUsers);
    const updatedUser = savedUsers.find(
      (item) => clean(item.id) === clean(matchedUser.id)
    );

    res.json({
      ok: true,
      user: buildSessionUser(updatedUser || matchedUser, session),
      message: "Password updated for all devices.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  try {
    const sessionToken = clean(req.body?.sessionToken);
    if (!sessionToken) {
      return res.json({ ok: true, message: "Already logged out." });
    }

    const sessions = loadAppSessions().filter(
      (session) => clean(session.sessionToken) !== sessionToken
    );
    saveAppSessions(sessions);

    res.json({ ok: true, message: "Logged out." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/logout-all", (_req, res) => {
  try {
    saveAppSessions([]);
    res.json({ ok: true, message: "Logged out all devices." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/logout-user-devices", (req, res) => {
  try {
    const userId = clean(req.body?.userId);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing userId.",
      });
    }

    const nextSessions = loadAppSessions().filter(
      (session) => clean(session.userId) !== userId
    );
    saveAppSessions(nextSessions);

    res.json({
      ok: true,
      message: "Logged out this user on all devices.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.get("/api/auth/sessions", (_req, res) => {
  try {
    const sessions = loadAppSessions()
      .filter((session) => session.isActive !== false)
      .sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime());

    res.json({ ok: true, sessions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/auth/session/:sessionToken", (req, res) => {
  try {
    const sessionToken = clean(req.params.sessionToken);
    const session = loadAppSessions().find(
      (item) => clean(item.sessionToken) === sessionToken && item.isActive !== false
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found." });
    }

    const users = loadAppUsers();
    const user = users.find(
      (item) => clean(item.id) == clean(session.userId) && item.isActive !== false
    );

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }

    const updatedSession = {
      ...session,
      lastSeenAt: new Date().toISOString(),
    };

    const nextSessions = loadAppSessions().map((item) =>
      clean(item.sessionToken) === sessionToken ? updatedSession : item
    );
    saveAppSessions(nextSessions);

    res.json({
      ok: true,
      user: buildSessionUser(user, updatedSession),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
