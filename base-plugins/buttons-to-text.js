var jsPsychButtonsToText = (function (jspsych) {
    "use strict";
  
    const info = {
      name: "ButtonsToText",
      parameters: {
        html: {
          type: jspsych.ParameterType.HTML_STRING,
          default: undefined,
        },
        choices: {
          type: jspsych.ParameterType.STRING,
          default: undefined,
        }
      },
    };
  
    /**
     * **ButtonsToText**
     *
     *
     * @author Daniel Wurgaft
     */
    class jsPsychButtonsToText  {
      constructor(jsPsych) {
        this.jsPsych = jsPsych;
      }
  
      trial(display_element, trial) {
  
        var jspsych = this.jsPsych
  
        var response = {rt: null, response: null}
  
        var html = trial.html;
  
  
      //display buttons
      var buttons = [];
      var button_html = '<button class="jspsych-btn">%choice%</button>'
      for (var i = 0; i < trial.choices.length; i++) {
                buttons.push(button_html);}
  
  
        for (var i = 0; i < trial.choices.length; i++) {
          var str = buttons[i].replace(/%choice%/g, trial.choices[i]);
          html +=
            '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
            "2px" +
            " " +
            "8px" +
            '" id="jspsych-audio-button-response-button-' +
            i +
            '" data-choice="' +
            trial.choices[i] +
            '">' +
            str +
            '</div>';
        }
        html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        'delete' +
        '" data-choice="' +
        'delete' +
        '">' +
        '<button class="jspsych-btn">Delete</button>' +
        "</div>";
        html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        'reset' +
        '" data-choice="' +
        'reset' +
        '">' +
        '<button class="jspsych-btn">Reset Response</button>' +
        "</div>";
        html += "</div>";
  
        html += '<input type="text" id="input" value="" name="#jspsych-survey-text-response' + '" size="18' + '" ' + '"style=" position: absolute; top: 5%;"></input>';
        
        html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        'submit' +
        '" data-choice="' +
        'submit' +
        '">' +
        '<button class="jspsych-btn">Submit Response</button>' +
        "</div>";
        html += "</div>";
  

        display_element.innerHTML = html;
  
        // start time
        var startTime = performance.now();
        
        
        function button_response(e) {
          var choice = e.currentTarget.getAttribute("data-choice"); // don't use dataset for jsdom compatibility
          if (choice == "submit"){
            after_response(jspsych)
          }
          else if (choice == "reset"){
            document.getElementById("input").value = "";
          }
          else if (choice == "delete"){
            document.getElementById("input").value = document.getElementById("input").value.slice(0,-2);
          }
          else{
            document.getElementById("input").value += choice;
          }
        }
  
        function disable_buttons() {
          var btns = document.querySelectorAll(
            ".jspsych-audio-button-response-button"
          );
          for (var i = 0; i < btns.length; i++) {
            var btn_el = btns[i].querySelector("button");
            if (btn_el) {
              btn_el.disabled = true;
            }
            btns[i].removeEventListener("click", button_response);
          }
        }
  
        function enable_buttons() {
          var btns = document.querySelectorAll(
            ".jspsych-audio-button-response-button"
          );
          for (var i = 0; i < btns.length; i++) {
            var btn_el = btns[i].querySelector("button");
            if (btn_el) {
              btn_el.disabled = false;
            }
            btns[i].addEventListener("click", button_response);
          }
        }
  
  
        enable_buttons()
        
      
        function after_response(jspsych) {
          const regex1 = new RegExp('^(🔴*🟠*🟡*🟢*🔵*🟣*🟤*⚫*)*$', 'u');
          if (document.getElementById("input").value == ""){
            alert("Response must not be empty!")
          }
          else if (!regex1.test(document.getElementById("input").value)){
            alert("Response must only be comprised of colored circles!")
          }
          else{
          
          // measure rt
          var endTime = performance.now();
          var rt = Math.round(endTime - startTime);
  
  
          response.response = document.getElementById("input").value;
          response.rt = rt;
  
          // disable all the buttons after a response
          disable_buttons();
  
          var trial_data = {
            rt: response.rt,
            response: response.response,
          };
          
  
          display_element.innerHTML = "";
    
  
        // end trial
        jspsych.finishTrial(trial_data);
        }
      }
  
    }
  }
    jsPsychButtonsToText.info = info;
  
    return jsPsychButtonsToText;
  })(jsPsychModule);
  