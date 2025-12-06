<?php

namespace Stanford\ConditionalFieldValidator;

class ConditionalFieldValidator extends \ExternalModules\AbstractExternalModule
{

    private $rules = [];

    public function __construct()
    {
        parent::__construct();
        // Other code to run when object is instantiated
    }

    public function redcap_data_entry_form()
    {
        $this->loadPage("pages/conditions.php");
    }

    public function redcap_survey_page_top()
    {
        $this->loadPage("pages/conditions.php");
    }


    public function loadPage($page)
    {
        require_once($page);
    }

    public function getValidateRules()
    {
        if (empty($this->rules)) {
            $this->rules = $this->getSubSettings('rules');
        }
        return $this->rules;
    }
}
