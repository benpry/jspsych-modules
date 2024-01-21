var jsPsychButtonsToTextAudioRecording = (function (jspsych) {
  "use strict";

  const info = {
    name: "ButtonsToText-audio-recording",
    parameters: {
      html: {
        type: jspsych.ParameterType.HTML_STRING,
        default: undefined,
      },
      choices: {
        type: jspsych.ParameterType.STRING,
        default: undefined,
      },
    },
  };

  /**
   * **ButtonsToText**
   *
   *
   * @author Daniel Wurgaft
   */
  class jsPsychButtonsToTextAudioRecording {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
      this.recorded_data_chunks = [];
    }

    trial(display_element, trial) {
      var jspsych = this.jsPsych;

      var response = { rt: null, response: null };

      var html = trial.html;

      //display buttons
      var buttons = [];
      var button_html = '<button class="jspsych-btn">%choice%</button>';
      for (var i = 0; i < trial.choices.length; i++) {
        buttons.push(button_html);
      }

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
          "</div>";
      }
      html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        "delete" +
        '" data-choice="' +
        "delete" +
        '">' +
        '<button class="jspsych-btn">Delete</button>' +
        "</div>";
      html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        "reset" +
        '" data-choice="' +
        "reset" +
        '">' +
        '<button class="jspsych-btn">Reset Response</button>' +
        "</div>";
      html += "</div>";

      html +=
        '<input type="text" id="input" value="" name="#jspsych-survey-text-response' +
        '" size="18' +
        '" ' +
        '"style=" position: absolute; top: 5%;"></input>';

      html +=
        '<div class="jspsych-audio-button-response-button" style="cursor: pointer; display: inline-block; margin:' +
        "2px" +
        " " +
        "8px" +
        '" id="jspsych-audio-button-response-button-' +
        "submit" +
        '" data-choice="' +
        "submit" +
        '">' +
        '<button class="jspsych-btn">Submit Response</button>' +
        "</div>";
      html += "</div>";

      display_element.innerHTML = html;
      // start recording
      this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();
      this.setupRecordingEvents(display_element, trial);
      this.startRecording();
      // start time
      var startTime = performance.now();

      function button_response(e) {
        var choice = e.currentTarget.getAttribute("data-choice"); // don't use dataset for jsdom compatibility
        if (choice == "submit") {
          after_response(jspsych);
        } else if (choice == "reset") {
          document.getElementById("input").value = "";
        } else if (choice == "delete") {
          document.getElementById("input").value = document
            .getElementById("input")
            .value.slice(0, -2);
        } else {
          document.getElementById("input").value += choice;
        }
      }

      function disable_buttons() {
        var btns = document.querySelectorAll(
          ".jspsych-audio-button-response-button",
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
          ".jspsych-audio-button-response-button",
        );
        for (var i = 0; i < btns.length; i++) {
          var btn_el = btns[i].querySelector("button");
          if (btn_el) {
            btn_el.disabled = false;
          }
          btns[i].addEventListener("click", button_response);
        }
      }

      enable_buttons();

      this.end_trial = () => {
        // measure rt
        var endTime = performance.now();
        var rt = Math.round(endTime - startTime);

        console.log("end trial");

        // stop the recording
        this.stopRecording().then(() => {
          console.log("recording is over");
          this.recorder.removeEventListener(
            "dataavailable",
            this.data_available_handler,
          );
          this.recorder.removeEventListener("start", this.start_event_handler);
          this.recorder.removeEventListener("stop", this.stop_event_handler);
          // kill any remaining setTimeout handlers
          this.jsPsych.pluginAPI.clearAllTimeouts();

          response.response = document.getElementById("input").value;
          response.rt = rt;

          // disable all the buttons after a response
          disable_buttons();

          var trial_data = {
            rt: response.rt,
            response: response.response,
            recording: this.recording,
          };

          display_element.innerHTML = "";

          // end trial
          jspsych.finishTrial(trial_data);
        });
      };

      const after_response = (jspsych) => {
        const regex1 = new RegExp("^(🔴*🟠*🟡*🟢*🔵*🟣*🟤*⚫*)*$", "u");
        if (document.getElementById("input").value == "") {
          alert("Response must not be empty!");
        } else if (!regex1.test(document.getElementById("input").value)) {
          alert("Response must only be comprised of colored circles!");
        } else {
          this.end_trial();
        }
      };
    }

    // functions for recording audio
    setupRecordingEvents(display_element, trial) {
      this.data_available_handler = (e) => {
        if (e.data.size > 0) {
          this.recorded_data_chunks.push(e.data);
        }
      };

      this.stop_event_handler = () => {
        const data = new Blob(this.recorded_data_chunks, {
          type: "audio/webm",
        });
        this.audio_url = URL.createObjectURL(data);
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          const base64 = reader.result.split(",")[1];
          this.recording = base64;
          this.load_resolver();
        });
        reader.readAsDataURL(data);
      };

      this.start_event_handler = (e) => {
        // resets the recorded data
        this.recorded_data_chunks.length = 0;
        this.recorder_start_time = e.timeStamp;
      };

      this.recorder.addEventListener(
        "dataavailable",
        this.data_available_handler,
      );
      this.recorder.addEventListener("stop", this.stop_event_handler);
      this.recorder.addEventListener("start", this.start_event_handler);
    }

    startRecording() {
      this.recorder.start();
    }

    stopRecording() {
      this.recorder.stop();
      return new Promise((resolve) => {
        this.load_resolver = resolve;
      });
    }
  }
  jsPsychButtonsToTextAudioRecording.info = info;

  return jsPsychButtonsToTextAudioRecording;
})(jsPsychModule);
