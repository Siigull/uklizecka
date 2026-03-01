// Forms templates for discord modals

export function generate_template_modal_edit(id, max_users, place, name, instructions) {
  return {
    "title": `Cleaning template`,
    "custom_id": "edit-template-modal",
    "components": [
      {
        "type": 18,
        "label": "Cleaning id.",
        "component": {
          "type": 3,
          "custom_id": "id",
          "options": [
            { "label": id, "value": id, "default": true},
          ]
        }
      },
      {
        "type": 18,
        "label": "Maximum number of people cleaning.",
        "component": {
          "type": 3,
          "custom_id": "max_users",
          "placeholder": max_users,
          "options": [
            { "label": "1", "value": "1", "default": max_users == 1 },
            { "label": "2", "value": "2", "default": max_users == 2 },
            { "label": "3", "value": "3", "default": max_users == 3 },
            { "label": "4", "value": "4", "default": max_users == 4 },
            { "label": "5", "value": "5", "default": max_users == 5 },
            { "label": "6", "value": "6", "default": max_users == 6 }
          ]
        }
      },
      {
        "type": 18,
        "label": "Place of cleaning.",
        "component": {
          "type": 4,
          "custom_id": "place",
          "style": 1,
          "placeholder": "Ideálně něco jako R212 - Kachna",
          "value": place,
        }
      },
      {
        "type": 18,
        "label": "Name of the template",
        "component": {
          "type": 4,
          "custom_id": "name",
          "style": 1,
          "placeholder": "Jméno úklidu",
          "value": name,
        }
      },
      {
        "type": 18,
        "label": "Cleaning instructions",
        "component": {
          "type": 4,
          "custom_id": "instructions",
          "style": 2,
          "placeholder": "Paste Google Docs link here...",
          "value": instructions,
        }
      }
    ]
  };
}

export function generate_template_modal() {
  return {
    "title": "Cleaning template",
    "custom_id": "create-template-modal",
    "components": [
      {
        "type": 18,
        "label": "Maximum number of people cleaning.",
        "component": {
          "type": 3,
          "custom_id": "max_users",
          "options": [
            { "label": "1", "value": "1" },
            { "label": "2", "value": "2" },
            { "label": "3", "value": "3" },
            { "label": "4", "value": "4" },
            { "label": "5", "value": "5" },
            { "label": "6", "value": "6" }
          ]
        }
      },
      {
        "type": 18,
        "label": "Place of cleaning.",
        "component": {
          "type": 4,
          "custom_id": "place",
          "style": 1,
          "placeholder": "Ideálně něco jako R212 - Kachna",
        }
      },
      {
        "type": 18,
        "label": "Name of the template",
        "component": {
          "type": 4,
          "custom_id": "name",
          "style": 1,
          "placeholder": "Jméno úklidu",
        }
      },
      {
        "type": 18,
        "label": "Cleaning instructions",
        "component": {
          "type": 4,
          "custom_id": "instructions",
          "style": 2,
          "placeholder": "Paste Google Docs link here...",
        }
      }
    ]
  };
}

export function generate_cleaning_modal(db) {
  let templates = db.get_templates();
  let template_name_id_pairs = []

  for (const t of templates) {
    template_name_id_pairs.push({"label": t.name, "value": t.id});
  }

  return {
    "title": "Cleaning",
    "custom_id": "create-cleaning-modal",
    "components": [
      {
        "type": 18,
        "label": "Cleaning template.",
        "component": {
          "type": 3,
          "custom_id": "template",
          "placeholder": "Select a template...",
          "options": template_name_id_pairs,
        }
      },
      {
        "type": 18,
        "label": "Start date.",
        "component": {
          "type": 4,
          "custom_id": "start_date",
          "style": 1,
          "placeholder": "YYYY-MM-DD",
        }
      },
      {
        "type": 18,
        "label": "End date.",
        "component": {
          "type": 4,
          "custom_id": "end_date",
          "style": 1,
          "placeholder": "YYYY-MM-DD"
        }
      },
      {
        "type": 18,
        "label": "Number of repetitions.",
        "component": {
          "type": 3,
          "custom_id": "repetitions",
          "placeholder": "Select a number...",
          "options": [
            { "label": "1",  "value": 1  },
            { "label": "2",  "value": 2  },
            { "label": "3",  "value": 3  },
            { "label": "4",  "value": 4  },
            { "label": "5",  "value": 5  },
            { "label": "6",  "value": 6  },
            { "label": "7",  "value": 7  },
            { "label": "8",  "value": 8  },
            { "label": "9",  "value": 9  },
            { "label": "10", "value": 10 },
            { "label": "11", "value": 11 },
            { "label": "12", "value": 12 },
            { "label": "13", "value": 13 }
          ]
        }
      }
    ]
  };
}
