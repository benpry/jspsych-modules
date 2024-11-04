// Audio analysis scripts thanks to Claude
async function analyzeRecordedAudio(blob, fftSize = 2048, nSeconds = 10) {
  // Previous FFT implementation remains the same...
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);

  // get only the last n seconds
  const startIdx = Math.max(
    0,
    channelData.length - nSeconds * audioBuffer.sampleRate,
  );
  const lastSecondsChannelData = channelData.slice(startIdx);

  const sampleRate = audioBuffer.sampleRate;
  const numSegments = Math.floor(lastSecondsChannelData.length / fftSize);
  const results = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * fftSize;
    const end = start + fftSize;
    const segment = lastSecondsChannelData.slice(start, end);

    const fft = new FFT(segment.length);
    const spectrum = fft.forward(Array.from(segment));

    const magnitudes = new Array(fft.spectrum.length);
    for (let j = 0; j < fft.spectrum.length; j++) {
      magnitudes[j] = Math.sqrt(
        Math.pow(fft.spectrum[j].real, 2) + Math.pow(fft.spectrum[j].imag, 2),
      );
    }

    results.push({
      timeOffset: i * (fftSize / sampleRate),
      frequencyData: magnitudes,
      timeData: Array.from(segment),
    });
  }

  await audioContext.close();

  return {
    results,
    metadata: {
      duration: audioBuffer.duration,
      sampleRate,
      fftSize,
      frequencyBinCount: fftSize / 2,
      frequencyResolution: sampleRate / fftSize,
      totalSegments: numSegments,
      timeStep: fftSize / sampleRate,
    },
  };
}

// FFT implementation
class FFT {
  constructor(size) {
    this.size = size;
    this.spectrum = new Array(size / 2)
      .fill()
      .map(() => ({ real: 0, imag: 0 }));

    // Precompute reverse bits table
    this.reverseBits = new Array(size);
    for (let i = 0; i < size; i++) {
      this.reverseBits[i] = this.reverse(i);
    }
  }

  reverse(num) {
    let result = 0;
    let bits = Math.log2(this.size);
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (num & 1);
      num >>= 1;
    }
    return result;
  }

  forward(input) {
    const n = this.size;
    const output = new Array(n);

    // Bit reversal
    for (let i = 0; i < n; i++) {
      output[this.reverseBits[i]] = input[i];
    }

    // FFT computation
    for (let size = 2; size <= n; size *= 2) {
      const halfsize = size / 2;
      const step = Math.PI / halfsize;

      for (let i = 0; i < n; i += size) {
        let angle = 0;

        for (let j = i; j < i + halfsize; j++) {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const tReal = output[j + halfsize] * cos + output[j] * sin;
          const tImag = output[j + halfsize] * sin - output[j] * cos;

          output[j + halfsize] = output[j] - tReal;
          output[j] = output[j] + tReal;

          angle += step;
        }
      }
    }

    // Fill spectrum array
    for (let i = 0; i < n / 2; i++) {
      this.spectrum[i] = {
        real: output[i],
        imag: output[i + n / 2],
      };
    }

    return this.spectrum;
  }
}

function getFrequencyRangeActivity(analysis, minFreq, maxFreq) {
  const { sampleRate, fftSize } = analysis.metadata;
  const binSize = sampleRate / fftSize;

  // Calculate which FFT bins correspond to our frequency range
  const minBin = Math.floor(minFreq / binSize);
  const maxBin = Math.ceil(maxFreq / binSize);

  // Analyze each segment
  const rangeActivity = analysis.results.map((segment) => {
    // Sum up the magnitude of all frequencies in our range
    let totalActivity = 0;
    for (
      let bin = minBin;
      bin <= maxBin && bin < segment.frequencyData.length;
      bin++
    ) {
      totalActivity += segment.frequencyData[bin];
    }

    return {
      timeOffset: segment.timeOffset,
      activity: totalActivity,
      // Also include the average for this range
      averageActivity: totalActivity / (maxBin - minBin + 1),
    };
  });

  // Calculate some statistics for the entire range
  const activities = rangeActivity.map((r) => r.activity);
  const stats = {
    minActivity: Math.min(...activities),
    maxActivity: Math.max(...activities),
    averageActivity: activities.reduce((a, b) => a + b, 0) / activities.length,
    frequencyRange: {
      min: minFreq,
      max: maxFreq,
      binSize,
      minBin,
      maxBin,
    },
  };

  return {
    rangeActivity,
    stats,
  };
}

async function processRecordingWithRanges(
  blob,
  frequencyRanges,
  nSeconds = 10,
) {
  try {
    const analysis = await analyzeRecordedAudio(blob, 2048, nSeconds);

    // Analyze each frequency range
    const rangeAnalysis = {};
    for (const [rangeName, range] of Object.entries(frequencyRanges)) {
      rangeAnalysis[rangeName] = getFrequencyRangeActivity(
        analysis,
        range.min,
        range.max,
      );
    }

    return rangeAnalysis;
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  }
}

var jsPsychHtmlButtonResponseAudioRecording = (function (jspsych) {
  "use strict";

  const info = {
    name: "html-button-response-audio-recording",
    parameters: {
      /** The HTML string to be displayed */
      stimulus: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: "Stimulus",
        default: undefined,
      },
      /** Array containing the label(s) for the button(s). */
      choices: {
        type: jspsych.ParameterType.STRING,
        pretty_name: "Choices",
        default: undefined,
        array: true,
      },
      /** The HTML for creating button. Can create own style. Use the "%choice%" string to indicate where the label from the choices parameter should be inserted. */
      button_html: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: "Button HTML",
        default: '<button class="jspsych-btn">%choice%</button>',
        array: true,
      },
      /** Any content here will be displayed under the button(s). */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: "Prompt",
        default: null,
      },
      /** How long to show the stimulus. */
      stimulus_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Stimulus duration",
        default: null,
      },
      /** How long to show the trial. */
      trial_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Trial duration",
        default: null,
      },
      /** The vertical margin of the button. */
      margin_vertical: {
        type: jspsych.ParameterType.STRING,
        pretty_name: "Margin vertical",
        default: "0px",
      },
      /** The horizontal margin of the button. */
      margin_horizontal: {
        type: jspsych.ParameterType.STRING,
        pretty_name: "Margin horizontal",
        default: "8px",
      },
      /** If true, then trial will end when user responds. */
      response_ends_trial: {
        type: jspsych.ParameterType.BOOL,
        pretty_name: "Response ends trial",
        default: true,
      },
      voice_check_frequency: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Frequency to check for voice activity",
        default: null,
      },
      alert_threshold: {
        type: jspsych.ParameterType.NUMBER,
        pretty_name: "Minimum threshold for average voice activity",
        default: 1,
      },
    },
  };
  /**
   * html-button-response
   * jsPsych plugin for displaying a stimulus and getting a button response
   * @author Josh de Leeuw
   * @see {@link https://www.jspsych.org/plugins/jspsych-html-button-response/ html-button-response plugin documentation on jspsych.org}
   */
  class HtmlButtonResponseAudioRecordingPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
      this.recorded_data_chunks = [];
    }

    trial(display_element, trial) {
      // display stimulus
      var html =
        '<div id="jspsych-html-button-response-stimulus">' +
        trial.stimulus +
        "</div>";
      //display buttons
      var buttons = [];
      if (Array.isArray(trial.button_html)) {
        if (trial.button_html.length == trial.choices.length) {
          buttons = trial.button_html;
        } else {
          console.error(
            "Error in html-button-response-audio-recording plugin. The length of the button_html array does not equal the length of the choices array",
          );
        }
      } else {
        for (var i = 0; i < trial.choices.length; i++) {
          buttons.push(trial.button_html);
        }
      }
      html += '<div id="jspsych-html-button-response-btngroup">';
      for (var i = 0; i < trial.choices.length; i++) {
        var str = buttons[i].replace(/%choice%/g, trial.choices[i]);
        html +=
          '<div class="jspsych-html-button-response-button" style="display: inline-block; margin:' +
          trial.margin_vertical +
          " " +
          trial.margin_horizontal +
          '" id="jspsych-html-button-response-button-' +
          i +
          '" data-choice="' +
          i +
          '">' +
          str +
          "</div>";
      }
      html += "</div>";
      html += "<canvas id='spectrogram' width='800' height='400'></canvas>";
      //show prompt if there is one
      if (trial.prompt !== null) {
        html += trial.prompt;
      }
      display_element.innerHTML = html;
      // start time
      this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();
      this.setupRecordingEvents(display_element, trial);
      this.startRecording(trial.voice_check_frequency);
      var start_time = performance.now();
      // add event listeners to buttons
      for (var i = 0; i < trial.choices.length; i++) {
        display_element
          .querySelector("#jspsych-html-button-response-button-" + i)
          .addEventListener("click", (e) => {
            var btn_el = e.currentTarget;
            var choice = btn_el.getAttribute("data-choice"); // don't use dataset for jsdom compatibility
            after_response(choice);
          });
      }
      // store response
      var response = {
        rt: null,
        button: null,
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

          // gather the data to store for the trial
          var trial_data = {
            rt: response.rt,
            stimulus: trial.stimulus,
            response: response.button,
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
      const after_response = (choice) => {
        var end_time = performance.now();
        var rt = Math.round(end_time - start_time);
        response.button = parseInt(choice);
        response.rt = rt;

        // measure rt
        // after a valid response, the stimulus will have the CSS class 'responded'
        // which can be used to provide visual feedback that a response was recorded
        display_element.querySelector(
          "#jspsych-html-button-response-stimulus",
        ).className += " responded";
        // disable all the buttons after a response
        var btns = document.querySelectorAll(
          ".jspsych-html-button-response-button button",
        );
        for (var i = 0; i < btns.length; i++) {
          //btns[i].removeEventListener('click');
          btns[i].setAttribute("disabled", "disabled");
        }
        if (trial.response_ends_trial) {
          this.end_trial();
        }
      };

      // hide image if timing is set
      if (trial.stimulus_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(() => {
          display_element.querySelector(
            "#jspsych-html-button-response-stimulus",
          ).style.visibility = "hidden";
        }, trial.stimulus_duration);
      }
      // end trial if time limit is set
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
        response: this.jsPsych.randomization.randomInt(
          0,
          trial.choices.length - 1,
        ),
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
        this.jsPsych.pluginAPI.clickTarget(
          display_element.querySelector(
            `div[data-choice="${data.response}"] button`,
          ),
          data.rt,
        );
      }
    }

    // functions for recording audio
    setupRecordingEvents(display_element, trial) {
      this.check_inactive = async (data) => {
        const ranges = {
          speech: { min: 85, max: 255 },
        };
        const rangeAnalysis = await processRecordingWithRanges(
          data,
          ranges,
          trial.voice_check_frequency,
        );
        const voiceActivity = rangeAnalysis.speech.rangeActivity;
        const totalAverageActivity =
          voiceActivity.reduce((acc, val) => acc + val.averageActivity, 0) /
          voiceActivity.length;

        console.log("total average activity: ", totalAverageActivity);

        if (totalAverageActivity < trial.alert_threshold) {
          alert("Remember to say your thoughts aloud!");
        }
      };

      this.data_available_handler = (e) => {
        if (e.data.size > 0) {
          this.recorded_data_chunks.push(e.data);
          if (
            trial.voice_check_frequency !== null &&
            this.recorder.state === "recording"
          ) {
            const data = new Blob(this.recorded_data_chunks, {
              type: "audio/webm",
            });
            this.check_inactive(data);
          }
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

    startRecording(freq_s) {
      if (freq_s === null) {
        this.recorder.start();
      } else {
        this.recorder.start(freq_s * 1000);
      }
    }

    stopRecording() {
      this.recorder.stop();
      return new Promise((resolve) => {
        this.load_resolver = resolve;
      });
    }
  }
  HtmlButtonResponseAudioRecordingPlugin.info = info;

  return HtmlButtonResponseAudioRecordingPlugin;
})(jsPsychModule);
