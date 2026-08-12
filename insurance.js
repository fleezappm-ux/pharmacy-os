"use strict";

const GAS_URL = "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const categories = ["医保", "国保", "後期高齢", "公費（単・複）", "労災", "総合計"];
const totalCategoryIndex = categories.length - 1;
const fields = [
  "caseCount",
  "medicalCount",
  "dentalCount",
  "totalCount",
  "rewardPoints"
];

const form = document.getElementById("insurance-form");
const rowsContainer = document.getElementById("insurance-rows");
const yearSelect = document.getElementById("target-year");
const monthSelect = document.getElementById("target-month-number");

const institutionMedical =
  document.getElementById("institution-medical");
const institutionDental =
  document.getElementById("institution-dental");
const institutionTotal =
  document.getElementById("institution-total");

const homecareMedicalCases =
  document.getElementById("homecare-medical-cases");
const homecareMedicalVisits =
  document.getElementById("homecare-medical-visits");
const homecareCareCases =
  document.getElementById("homecare-care-cases");
const homecareCareVisits =
  document.getElementById("homecare-care-visits");

const saveButton = document.getElementById("save-button");
const statusMessage =
  document.getElementById("status-message");

function createNumberInput(field, readOnly = false) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.inputMode = "numeric";
  input.dataset.field = field;
  input.readOnly = readOnly;

  if (readOnly) {
    input.tabIndex = -1;
  }

  return input;
}

function renderRows() {
  categories.forEach((category, index) => {
    const row = document.createElement("tr");
    row.dataset.order = String(index + 1);

    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = category;
    row.appendChild(heading);

    const isTotalRow = index === totalCategoryIndex;

    fields.forEach((field) => {
      const cell = document.createElement("td");

      cell.appendChild(
        createNumberInput(
          field,
          isTotalRow || field === "totalCount"
        )
      );

      row.appendChild(cell);
    });

    rowsContainer.appendChild(row);
  });
}

function initializeMonthSelectors() {
  const today = new Date();
  const currentYear = today.getFullYear();

  for (
    let year = currentYear - 10;
    year <= currentYear + 3;
    year += 1
  ) {
    const option = new Option(
      `${year}年`,
      String(year),
      false,
      year === currentYear
    );

    yearSelect.add(option);
  }

  for (let month = 1; month <= 12; month += 1) {
    const option = new Option(
      `${month}月`,
      String(month),
      false,
      month === today.getMonth() + 1
    );

    monthSelect.add(option);
  }
}

function sumInputs(first, second) {
  if (first.value === "" && second.value === "") {
    return "";
  }

  return String(
    Number(first.value || 0) +
    Number(second.value || 0)
  );
}

function updateRowTotal(row) {
  const medical =
    row.querySelector('[data-field="medicalCount"]');

  const dental =
    row.querySelector('[data-field="dentalCount"]');

  row.querySelector(
    '[data-field="totalCount"]'
  ).value = sumInputs(medical, dental);
}

function updateGrandTotal() {
  const rows =
    Array.from(rowsContainer.querySelectorAll("tr"));

  const detailRows =
    rows.slice(0, totalCategoryIndex);

  const totalRow =
    rows[totalCategoryIndex];

  fields.forEach((field) => {
    const inputs = detailRows.map((row) =>
      row.querySelector(`[data-field="${field}"]`)
    );

    const hasValue =
      inputs.some((input) => input.value !== "");

    const total = inputs.reduce(
      (sum, input) =>
        sum + Number(input.value || 0),
      0
    );

    totalRow.querySelector(
      `[data-field="${field}"]`
    ).value = hasValue ? String(total) : "";
  });
}

function updateInstitutionTotal() {
  institutionTotal.value =
    sumInputs(
      institutionMedical,
      institutionDental
    );
}

function toNullableNumber(value) {
  return value === "" ? null : Number(value);
}

function collectRows() {
  return Array.from(
    rowsContainer.querySelectorAll("tr")
  ).map((row, index) => ({
    category: categories[index],

    caseCount: toNullableNumber(
      row.querySelector(
        '[data-field="caseCount"]'
      ).value
    ),

    medicalCount: toNullableNumber(
      row.querySelector(
        '[data-field="medicalCount"]'
      ).value
    ),

    dentalCount: toNullableNumber(
      row.querySelector(
        '[data-field="dentalCount"]'
      ).value
    ),

    totalCount: toNullableNumber(
      row.querySelector(
        '[data-field="totalCount"]'
      ).value
    ),

    rewardPoints: toNullableNumber(
      row.querySelector(
        '[data-field="rewardPoints"]'
      ).value
    ),

    order: index + 1
  }));
}

function hasInsuranceInput(rows, institution) {
  const rowHasInput = rows.some((row) =>
    [
      row.caseCount,
      row.medicalCount,
      row.dentalCount,
      row.rewardPoints
    ].some((value) => value !== null)
  );

  const institutionHasInput = [
    institution.medicalCount,
    institution.dentalCount
  ].some((value) => value !== null);

  return rowHasInput || institutionHasInput;
}

function collectHomecareRows() {
  return [
    {
      category:
        "医療保険（在宅患者訪問薬剤管理指導）",

      caseCount: toNullableNumber(
        homecareMedicalCases.value
      ),

      visitCount: toNullableNumber(
        homecareMedicalVisits.value
      ),

      order: 1
    },
    {
      category:
        "介護保険（居宅療養管理指導 等）",

      caseCount: toNullableNumber(
        homecareCareCases.value
      ),

      visitCount: toNullableNumber(
        homecareCareVisits.value
      ),

      order: 2
    }
  ];
}

function hasHomecareInput(rows) {
  return rows.some(
    (row) =>
      row.caseCount !== null ||
      row.visitCount !== null
  );
}

rowsContainer.addEventListener(
  "input",
  (event) => {
    const row = event.target.closest("tr");

    if (
      !row ||
      Number(row.dataset.order) ===
        categories.length
    ) {
      return;
    }

    if (
      event.target.matches(
        '[data-field="medicalCount"], ' +
        '[data-field="dentalCount"]'
      )
    ) {
      updateRowTotal(row);
    }

    updateGrandTotal();
  }
);

institutionMedical.addEventListener(
  "input",
  updateInstitutionTotal
);

institutionDental.addEventListener(
  "input",
  updateInstitutionTotal
);

form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    saveButton.disabled = true;
    statusMessage.className =
      "status-message";

    statusMessage.textContent =
      "保存しています…";

    const targetMonth =
      `${yearSelect.value}-` +
      `${String(monthSelect.value).padStart(2, "0")}-01`;

    const rows = collectRows();

    const institution = {
      medicalCount: toNullableNumber(
        institutionMedical.value
      ),

      dentalCount: toNullableNumber(
        institutionDental.value
      ),

      totalCount: toNullableNumber(
        institutionTotal.value
      )
    };

    const homecareRows =
      collectHomecareRows();

    const payload = {
      action:
        "saveInsuranceAndHomecareRecords",

      targetMonth,

      rows,

      institution,

      saveInsurance:
        hasInsuranceInput(
          rows,
          institution
        ),

      homecareRows,

      saveHomecare:
        hasHomecareInput(homecareRows)
    };

    try {
      const response =
        await fetch(GAS_URL, {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body: JSON.stringify(payload)
        });

      const result =
        await response.json();

      if (!result.success) {
        throw new Error(
          result.message ||
          "保存に失敗しました。"
        );
      }

      statusMessage.className =
        "status-message success";

      statusMessage.textContent =
        result.message ||
        "Notionへの保存が完了しました。";
    } catch (error) {
      statusMessage.className =
        "status-message error";

      statusMessage.textContent =
        error.message ||
        "通信に失敗しました。";
    } finally {
      saveButton.disabled = false;
    }
  }
);

renderRows();
initializeMonthSelectors();
updateGrandTotal();
updateInstitutionTotal();
