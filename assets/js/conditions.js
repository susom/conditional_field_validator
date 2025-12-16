/**
 * ConditionalFieldValidatorModule
 *
 * This module applies conditional validation rules to REDCap data entry / survey fields.
 * Rules are passed from the External Module PHP side via json_encode into `rules`.
 *
 * For each rule:
 *  - All `trigger` conditions must be satisfied (field/value or regex-based).
 *  - When triggers are satisfied, all `validation` conditions are evaluated.
 *  - If any validation fails, the target field is visually highlighted and an info icon
 *    is displayed with a tooltip containing the validation error message.
 *
 * The module:
 *  - Attaches blur listeners to all fields participating in any rule.
 *  - Validates on field blur and on initial page load.
 *  - Disables form buttons while any validation errors are present.
 */
/**
 * ConditionalFieldValidatorModule
 *
 * This module applies conditional validation rules to REDCap data entry / survey fields.
 * Rules are passed from the External Module PHP side via json_encode into `rules`.
 *
 * For each rule:
 *  - All `trigger` conditions must be satisfied (field/value or regex-based).
 *  - When triggers are satisfied, all `validation` conditions are evaluated.
 *  - If any validation fails, the target field is visually highlighted and an info icon
 *    is displayed with a tooltip containing the validation error message.
 *
 * The module:
 *  - Attaches blur listeners to all fields participating in any rule.
 *  - Validates on field blur and on initial page load.
 *  - Disables form buttons while any validation errors are present.
 */
var ConditionalFieldValidatorModule = {
    /**
     * Initialize the module:
     *  - Abort if there are no rules.
     *  - Build an index of fields to rules.
     *  - Attach blur listeners to all participating fields.
     *  - Run an initial validation pass.
     */
    init: function () {
        var self = this;
        if (!Array.isArray(self.rules) || self.rules.length === 0) {
            return;
        }

        self.buildFieldRuleIndex();

        if (!self._debouncedValidate) {
            self._debouncedValidate = (function () {
                var timer = null;
                return function () {
                    clearTimeout(timer);
                    timer = setTimeout(function () {
                        self.validateAll();
                    }, 100);
                };
            })();
        }

        // Attach listeners for all involved fields
        Object.keys(self.fieldRuleIndex).forEach(function (fieldName) {
            var $fieldElems = $('[name="' + fieldName + '"]');
            if ($fieldElems.length === 0) {
                return;
            }

            // Some REDCap pages (and some browsers) don't reliably fire `input` for autofill/piping.
            // `keyup` covers typing; `change` covers selects/radios/checkboxes; `paste`/`cut` covers clipboard.
            $fieldElems.on('keyup change paste cut', function () {
                var val = $(this).val();
                if (val != null && String(val).trim() !== '') {
                    self._debouncedValidate();
                }
            });
        });

        // Fallback watcher for programmatic value updates that don't emit events
        if (!self._valueWatchTimer) {
            self._valueWatchLast = {};
            self._valueWatchTimer = setInterval(function () {
                try {
                    Object.keys(self.fieldRuleIndex).forEach(function (fname) {
                        var $els = $('[name="' + fname + '"]');
                        if ($els.length === 0) return;

                        var v;
                        var type = $els.attr('type');
                        if (type === 'radio' || type === 'checkbox') {
                            var $checked = $els.filter(':checked');
                            v = $checked.map(function () { return $(this).val(); }).get().join(',');
                        } else {
                            v = $els.val();
                        }

                        v = (v == null ? '' : String(v));
                        var last = self._valueWatchLast[fname];

                        if (last !== v) {
                            self._valueWatchLast[fname] = v;
                            if (v.trim() !== '') {
                                self._debouncedValidate();
                            }
                        }
                    });
                } catch (e) {
                    // fail silently
                }
            }, 250);
        }

        // Initial validation on page load
        self.validateAll();
    },

    /**
     * Build an index mapping field names to the list of rule indices that reference them.
     * This is useful if you later choose to optimize validation to only evaluate rules
     * related to a specific field. Currently, validateAll() still evaluates all rules.
     */
    buildFieldRuleIndex: function () {
        var self = this;
        self.fieldRuleIndex = {};

        self.rules.forEach(function (rule, idx) {
            if (Array.isArray(rule.trigger)) {
                rule.trigger.forEach(function (tr) {
                    var field = tr['trigger-field'];
                    if (!field) return;
                    if (!self.fieldRuleIndex[field]) self.fieldRuleIndex[field] = [];
                    self.fieldRuleIndex[field].push(idx);
                });
            }
            if (Array.isArray(rule.validation)) {
                rule.validation.forEach(function (v) {
                    var field = v['validation-field'];
                    if (!field) return;
                    if (!self.fieldRuleIndex[field]) self.fieldRuleIndex[field] = [];
                    self.fieldRuleIndex[field].push(idx);
                });
            }
        });
    },

    /**
     * Get the current value of a REDCap field by its name attribute.
     * Handles:
     *  - Single-value inputs (text, textarea, etc.)
     *  - Radio / checkbox groups (returns checked values joined by comma)
     *  - Select elements (single or multi-select).
     */
    getFieldValue: function (fieldName) {
        var $el = $('[name="' + fieldName + '"]');
        if ($el.length === 0) return '';

        var type = $el.attr('type');

        if (type === 'radio' || type === 'checkbox') {
            var $checked = $el.filter(':checked');
            if ($checked.length === 0) return '';
            if ($checked.length === 1) return $checked.val();
            return $checked.map(function () {
                return $(this).val();
            }).get().join(',');
        }

        if ($el.is('select')) {
            return $el.val() || '';
        }

        return $el.val() || '';
    },

    /**
     * Heuristically determine whether a condition string looks like a regular expression.
     * This allows the same configuration field to support both plain string equality
     * and regex matching without additional flags.
     */
    looksLikeRegex: function (pattern) {
        if (typeof pattern !== 'string') return false;
        // Simple heuristic: treat as regex if it contains common regex metacharacters
        return /[\\^$.*+?()[\]{}|]/.test(pattern);
    },

    /**
     * Check whether a value satisfies the given condition.
     * If the condition "looks like" a regex, it is evaluated as regex.
     * Otherwise, a simple string equality comparison is used.
     * Empty/null conditions are treated as "always true".
     */
    isMatch: function (value, condition) {
        if (condition === null || condition === undefined || condition === '') {
            return true;
        }

        value = (value == null ? '' : String(value)).trim();

        if (this.looksLikeRegex(condition)) {
            try {
                var regex = new RegExp(condition);
                return regex.test(value);
            } catch (e) {
                // If regex compilation fails, fall back to string comparison
                return value === condition;
            }
        } else {
            return value === condition;
        }
    },

    /**
     * Attach a tooltip to the info icon.
     * Uses Bootstrap/jQuery tooltip when available; otherwise falls back
     * to the native browser tooltip provided by the title attribute.
     */
    bindTooltip: function ($icon) {
        // Use Bootstrap/jQuery tooltip if available, otherwise browser default title
        try {
            if ($ && $.fn && $.fn.tooltip) {
                $icon.tooltip({
                    html: true,
                    container: 'body',
                    placement: 'right',
                    template:
                      '<div class="tooltip cfvm-red-tooltip" role="tooltip">' +
                          '<div class="tooltip-arrow"></div>' +
                          '<div class="tooltip-inner"></div>' +
                      '</div>'
                });
            }
        } catch (e) {
            // Fail silently; the native title attribute will still work
        }
    },

    /**
     * Remove all visual error indicators:
     *  - Remove .cfvm-invalid class and reset inline border/background styling.
     *  - Remove all info icons (.cfvm-info-icon).
     * This is called before each full validation pass.
     */
    clearFieldErrors: function () {
        $('.cfvm-invalid').removeClass('cfvm-invalid');
        $('[name]').css({'border': '', 'background-color': ''});
        $('.cfvm-info-icon').remove();
    },

    /**
     * Add a validation error indicator for a specific field:
     *  - Highlight the field with a red border and light red background.
     *  - Append an info icon near the field with a tooltip containing the message.
     *  - If an icon already exists, merge additional messages into its title.
     */
    addFieldError: function (fieldName, message) {
        var self = this;
        var $el = $('[name="' + fieldName + '"]');
        if ($el.length === 0) return;
        // For radio/checkbox groups, attach error styling to the last input
        var $target = $el.last();
        $target.addClass('cfvm-invalid');
        $target.css({
            'border': '2px solid #d9534f',
            'background-color': '#f9e2e2'
        });

        // Choose a wrapper element close to the field for placing the icon
        var $wrapper = $target.closest('td, div, span, .frmf, .frmedit');
        if ($wrapper.length === 0) $wrapper = $target.parent();

        var $existingIcon = $wrapper.find('.cfvm-info-icon').first();
        if ($existingIcon.length === 0) {
            var $icon = $('<i/>', {
                'class': 'cfvm-info-icon bi bi-exclamation-circle-fill',
                'title': message,
                'tabindex': 0,
                'aria-hidden': 'true',
                'style': 'cursor:pointer;font-size:20px;color:#d9534f;margin-left:6px;'
            });
            $wrapper.append($icon);
            this.bindTooltip($icon);
        } else {
            var oldTitle = $existingIcon.attr('title') || '';
            if (oldTitle.indexOf(message) === -1) {
                $existingIcon.attr('title', oldTitle ? oldTitle + '\n' + message : message);
            }
        }
    },

    /**
     * Evaluate all rules against the current field values:
     *  - For each rule, ensure all triggers pass.
     *  - If triggers pass, validate all configured validation targets.
     *  - Add visual error indicators for any failed validations.
     *  - Disable form buttons while any errors exist, re-enable when clear.
     */
    validateAll: function () {
        var self = this;

        // Clear previous errors/icons
        self.clearFieldErrors();

        // Evaluate each configured rule against current form values.
        self.rules.forEach(function (rule) {
            var triggersOK = true;

            if (Array.isArray(rule.trigger)) {
                // All trigger conditions must be true for this rule to activate.
                for (var i = 0; i < rule.trigger.length; i++) {
                    var tr = rule.trigger[i];
                    var field = tr['trigger-field'];
                    var cond = tr['trigger-field-condition'];
                    var value = self.getFieldValue(field);

                    if (!self.isMatch(value, cond)) {
                        triggersOK = false;
                        break;
                    }
                }
            }

            if (!triggersOK) {
                return;
            }

            if (Array.isArray(rule.validation)) {
                // When triggers are satisfied, validate all target fields for this rule.
                rule.validation.forEach(function (v) {
                    var vField = v['validation-field'];
                    var vCond = v['validation-field-condition'];
                    var msg = v['validation-field-error-message'] || 'Invalid value.';

                    var vValue = self.getFieldValue(vField);

                    // Only validate if there is a non-empty value in the validation field
                    if (vValue != null && String(vValue).trim() !== '') {
                        if (!self.isMatch(vValue, vCond)) {
                            self.addFieldError(vField, msg);
                        }
                    }
                });
            }
        });

        // Disable or enable form buttons depending on errors
        var hasErrors = $('.cfvm-info-icon').length > 0;
        // Disable or enable form buttons depending on errors
        var hasErrors = $('.cfvm-info-icon').length > 0;
        var $buttons = $('button, input[type="submit"], input[type="button"]');

// Set native disabled property
        $buttons.prop('disabled', hasErrors);

// Also sync jQuery UI button state for REDCap/jqbutton buttons
        try {
            $buttons.filter('.ui-button, .jqbutton').each(function () {
                var $btn = $(this);
                if (hasErrors) {
                    if (typeof $btn.button === 'function') {
                        $btn.button('disable');
                    }
                } else {
                    if (typeof $btn.button === 'function') {
                        $btn.button('enable');
                    }
                }
            });
        } catch (e) {
            // fail silently if jQuery UI isn't available somewhere
        }
    }
};

$('<style>')
  .prop('type','text/css')
  .html(
    '.cfvm-red-tooltip .tooltip-inner { background:#d9534f !important; color:white !important; }' +
    '.cfvm-red-tooltip .tooltip-arrow { border-right-color:#d9534f !important; }'
  )
  .appendTo('head');

// Auto-init on document ready
$(function () {
    ConditionalFieldValidatorModule.init();
});
