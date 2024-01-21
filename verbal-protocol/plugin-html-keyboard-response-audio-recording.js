var jsPsychHtmlKeyboardResponseAudioRecording = (function (jspsych) {
  "use strict";

  const info = {
    name: "html-keyboard-response-audio-recording",
    parameters: {
      /**
       * The HTML string to be displayed.
       */
      stimulus: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: "Stimulus",
        default: undefined,
      },
      /**
       * Array containing the key(s) the subject is allowed to press to respond to the stimulus.
       */
      choices: {
        type: jspsych.ParameterType.KEYS,
        pretty_name: "Choices",
        default: "ALL_KEYS",
      },
      /**
       * Any content here will be displayed below the stimulus.
       */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: "Prompt",
        default: null,
      },
      /**
       * How long to show the stimulus.
       */
      stimulus_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Stimulus duration",
        default: null,
      },
      /**
       * How long to show trial before it ends.
       */
      trial_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Trial duration",
        default: null,
      },
      /**
       * If true, trial will end when subject makes a response.
       */
      response_ends_trial: {
        type: jspsych.ParameterType.BOOL,
        pretty_name: "Response ends trial",
        default: true,
      },
    },
  };
  /**
   * **html-keyboard-response**
   *
   * jsPsych plugin for displaying a stimulus and getting a keyboard response
   *
   * @author Josh de Leeuw
   * @see {@link https://www.jspsych.org/plugins/jspsych-html-keyboard-response/ html-keyboard-response plugin documentation on jspsych.org}
   */
  class HtmlKeyboardResponsePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
      this.recorded_data_chunks = [];
    }

    trial(display_element, trial) {
      var new_html =
        '<div id="jspsych-html-keyboard-response-stimulus">' +
        trial.stimulus +
        "</div>";
      // add prompt
      if (trial.prompt !== null) {
        new_html += trial.prompt;
      }
      // draw
      display_element.innerHTML = new_html;
      this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();
      this.setupRecordingEvents(display_element, trial);
      this.startRecording();
      var start_time = performance.now();
      // store response
      var response = {
        rt: null,
        key: null,
      };
      // function to end trial when it is time
      this.end_trial = () => {
        // stop recording and remove event listeners
        this.stopRecording().then(() => {
          this.recorder.removeEventListener(
            "dataavailable",
            this.data_available_handler,
          );
          this.recorder.removeEventListener("start", this.start_event_handler);
          this.recorder.removeEventListener("stop", this.stop_event_handler);
          // kill any remaining setTimeout handlers
          this.jsPsych.pluginAPI.clearAllTimeouts();

          // kill any remaining setTimeout handlers
          this.jsPsych.pluginAPI.clearAllTimeouts();
          // kill keyboard listeners
          if (typeof keyboardListener !== "undefined") {
            this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
          }
          // gather the data to store for the trial
          var trial_data = {
            rt: response.rt,
            stimulus: trial.stimulus,
            response: response.key,
            recording: this.recording,
            estimated_stimulus_onset: Math.round(
              this.stimulus_start_time - this.recorder_start_time,
            ),
          };
          if (trial.save_audio_url) {
            trial_data.audio_url = this.audio_url;
          } else {
            URL.revokeObjectURL(this.audio_url);
          }

          // clear the display
          display_element.innerHTML = "";
          // move on to the next trial
          this.jsPsych.finishTrial(trial_data);
        });
      };

      // function to handle responses by the subject
      var after_response = (info) => {
        // after a valid response, the stimulus will have the CSS class 'responded'
        // which can be used to provide visual feedback that a response was recorded
        display_element.querySelector(
          "#jspsych-html-keyboard-response-stimulus",
        ).className += " responded";
        // only record the first response
        if (response.key == null) {
          response = info;
        }
        if (trial.response_ends_trial) {
          this.end_trial();
        }
      };
      // start the response listener
      if (trial.choices != "NO_KEYS") {
        var keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: after_response,
          valid_responses: trial.choices,
          rt_method: "performance",
          persist: false,
          allow_held_key: false,
        });
      }
      // hide stimulus if stimulus_duration is set
      if (trial.stimulus_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(() => {
          display_element.querySelector(
            "#jspsych-html-keyboard-response-stimulus",
          ).style.visibility = "hidden";
        }, trial.stimulus_duration);
      }
      // end trial if trial_duration is set
      if (trial.trial_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(this.end_trial, trial.trial_duration);
      }
    }

    simulate(trial, simulation_mode, simulation_options, load_callback) {
      if (simulation_mode == "data-only") {
        load_callback();
        this.simulate_data_only(trial, simulation_options);
      }
      if (simulation_mode == "visual") {
        this.simulate_visual(trial, simulation_options, load_callback);
      }
    }

    create_simulation_data(trial, simulation_options) {
      const default_data = {
        stimulus: trial.stimulus,
        rt: this.jsPsych.randomization.sampleExGaussian(500, 50, 1 / 150, true),
        response: this.jsPsych.pluginAPI.getValidKey(trial.choices),
      };
      const data = this.jsPsych.pluginAPI.mergeSimulationData(
        default_data,
        simulation_options,
      );
      this.jsPsych.pluginAPI.ensureSimulationDataConsistency(trial, data);
      return data;
    }

    simulate_data_only(trial, simulation_options) {
      const data = this.create_simulation_data(trial, simulation_options);
      this.jsPsych.finishTrial(data);
    }

    simulate_visual(trial, simulation_options, load_callback) {
      const data = this.create_simulation_data(trial, simulation_options);
      const display_element = this.jsPsych.getDisplayElement();
      this.trial(display_element, trial);
      load_callback();
      if (data.rt !== null) {
        this.jsPsych.pluginAPI.pressKey(data.response, data.rt);
      }
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
        // setup timer for hiding the stimulus
        if (trial.stimulus_duration !== null) {
          this.jsPsych.pluginAPI.setTimeout(() => {
            this.hideStimulus(display_element);
          }, trial.stimulus_duration);
        }
        // setup timer for ending the trial
        if (trial.trial_duration !== null) {
          this.jsPsych.pluginAPI.setTimeout(() => {
            // this check is necessary for cases where the
            // done_button is clicked before the timer expires
            if (this.recorder.state !== "inactive") {
              this.stopRecording().then(() => {
                if (trial.allow_playback) {
                  this.showPlaybackControls(display_element, trial);
                } else {
                  this.end_trial();
                }
              });
            }
          }, trial.trial_duration);
        }
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
  HtmlKeyboardResponsePlugin.info = info;

  return HtmlKeyboardResponsePlugin;
})(jsPsychModule);
