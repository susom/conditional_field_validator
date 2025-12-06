<?php

namespace Stanford\ConditionalFieldValidator;

/** @var ConditionalFieldValidator $this */
$rules = $this->getValidateRules();

?>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.3.0/font/bootstrap-icons.css">

<script src="<?php echo $this->getUrl('assets/js/conditions.js') ?>"></script>
<script>
    ConditionalFieldValidatorModule.rules = <?php echo json_encode($rules); ?>;
    ConditionalFieldValidatorModule.redcap_url = "<?php echo APP_PATH_WEBROOT_FULL . ltrim(APP_PATH_WEBROOT, '/'); ?>";
    window.addEventListener("load",
        function () {
            setTimeout(function () {
                ConditionalFieldValidatorModule.init();
            }, 100)
        }
        , true);
</script>
