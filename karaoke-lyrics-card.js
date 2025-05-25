import { html, svg, css, LitElement } from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";


class KaraokeLyricsCard extends LitElement {

  constructor() {
    super();

    // Defaults
    this._currentLyrics = "";
    this._parsedLyrics = "";
    this._currentLyric = "";
    this._mediaDuration = 0;
    this._mediaPosition = 0;
    this._mediaTitle = "";
    this._mediaArtist = "";
    this._mediaAlbum = "";
    this._mediaPositionUpdatedAt = new Date();
    this._currentPosition = 0;
    this._adjustmentSeconds = 0;

    this._tapAction = "toggle";
    this._holdAction = "more_info";
    this._doubleTapAction = "cancel";

    // To update card every half second
    this._timeUpdater = 1;
    var intervalid = setInterval(() => { this._timeUpdater++; }, 600);
    console.log(intervalid);
    localStorage.setItem("intervalid", intervalid);
    // Event listener bindings (https://developers.home-assistant.io/blog/2023/07/07/action-event-custom-cards/)

    this.addEventListener("click", this._tap);

    this._mouseIsDown = false;
    this._mouseIsDownTriggered = false;
    this._doubleClickTriggered = false;
    this.addEventListener("mousedown", this._mousedown);
    this.addEventListener("touchstart", this._mousedown);
    this.addEventListener("mouseup", this._mouseup);
    this.addEventListener("touchend", this._mouseup);

    this.addEventListener("dblclick", this._double_tap);

  }

  static get properties() {
    return {
      _config: {},
      _timeUpdater: {}
    };
  }

  setConfig(config) {

    if (!config.media_player) {
      throw new Error("You need to provide media player entity!");
    }

    if (!config.lrclib_server) {
      throw new Error("You need to provide lrclib lyrics server URL!");
    }

    var domain = config.media_player.split(".")[0];
    if (domain !== "media_player") {
      throw new Error("Provided entity is not a media_player!");
    }

    // Define the action config
    this._actionConfig = {
      entity: config.media_player,
      hold_action: {
        action: "more-info",
        start_listening: true,
      }
    };

    if (config.media_player) {
      this.media_player = config.media_player;
    }

    if (config.lrclib_server) {
      this.lrclib_server = config.lrclib_server;
    }

    if (config.adjustment_seconds) {
        this._adjustmentSeconds = config.adjustment_seconds;
    }

    if (config.tap_action) {
      this._tapAction = config.tap_action;
    }

    if (config.hold_action) {
      this._holdAction = config.hold_action;
    }

    if (config.double_tap_action) {
      this._doubleTapAction = config.double_tap_action;
    }

    this._config = config;
  }

  render() {

    if (!this.hass || !this._config) {
      return html``;
    }

    this._stateObj = this.hass.states[this._config.media_player];
    if (!this._stateObj) {
      return html` <ha-card>Unknown entity: ${this._config.media_player}</ha-card> `;
    }

    var lrclib_server = this._config.lrclib_server;
    var entityId = this._config.media_player;
    var state = this.hass.states[entityId];
    const stateStr = state ? state.state : 'unavailable';

      if (stateStr === "playing") {
        this._mediaDuration = state.attributes.media_duration;
        this._mediaPosition = state.attributes.media_position;
        this._mediaTitle = (state.attributes.media_title).replace(/\s*\(.*?\)|\s*\[.*?\]|\s*([fF]t\.|[fF]eat\.|[rR]emastered|[oO]riginal [vV]ersion).*?/gm,"");
        this._mediaArtist = ((state.attributes.media_artist.split(', '))[0]).replace(/\s*\(.*?\)|\s*\[.*?\]|\s*([fF]t\.|[fF]eat\.|[rR]emastered|[oO]riginal [vV]ersion).*?/gm,"");
        this._mediaAlbum = (state.attributes.media_album_name).replace(/\s*\(.*?\)|\s*\[.*?\]|\s*([fF]t\.|[fF]eat\.|[rR]emastered|[oO]riginal [vV]ersion).*?/gm,"");

        this._mediaPositionUpdatedAt = Date.parse(state.attributes.media_position_updated_at);
        this._currentPosition = Number(((Date.now() - this._mediaPositionUpdatedAt) / 1000) + this._mediaPosition + this._adjustmentSeconds);
        if (this._currentPosition >= this._mediaDuration) {
            this._currentPosition = this._mediaDuration;
        }

        if (this._mediaTitle === localStorage.getItem("mediaTitle") && this._mediaArtist === localStorage.getItem("mediaArtist")) {
            //Current song unchanged
            var cachedLyrics = localStorage.getItem("parsedLyrics");
            if (cachedLyrics && cachedLyrics !== "") {
              try {
                this._parsedLyrics = JSON.parse(cachedLyrics);
                // If parsedLyrics is not an array or is empty after parsing, treat as no lyrics
                if (!Array.isArray(this._parsedLyrics) || this._parsedLyrics.length === 0) {
                    this._parsedLyrics = ""; // Or [] depending on desired internal representation for "no lyrics"
                    this._currentLyric = "";
                }
              } catch (e) {
                console.error("Error parsing cached lyrics:", e);
                this._parsedLyrics = ""; // Or []
                this._currentLyric = "";
                localStorage.setItem("parsedLyrics", ""); // Clear corrupted cache
              }
            } else {
              // cachedLyrics is empty or null, so no lyrics
              this._parsedLyrics = ""; // Or []
              this._currentLyric = "";
            }
        }
        else {
            //New song playing
            this._parsedLyrics = "";
            this._currentLyric = "";
            this._currentLyrics = "";
            console.log(this._mediaArtist + " - " + this._mediaTitle + " Duration: " + this._mediaDuration + " media position: " + this._mediaPosition);
            var url = "http://" + lrclib_server + "/api/get?artist_name=" + this._mediaArtist + "&track_name=" + this._mediaTitle + "&album_name=" + this._mediaAlbum + "&duration=" + this._mediaDuration;
            loadJSON(url, success.bind(this), error.bind(this));
            localStorage.setItem("mediaTitle", this._mediaTitle);
            localStorage.setItem("mediaArtist", this._mediaArtist);
            localStorage.setItem("mediaAlbum", this._mediaAlbum);
        }

        if (this._parsedLyrics && this._parsedLyrics.length > 0) {
          // Ensure _parsedLyrics is an array and has content
          const lyricIndex = syncLyric(this._parsedLyrics, this._currentPosition);

          if (lyricIndex !== null && this._parsedLyrics[lyricIndex] && typeof this._parsedLyrics[lyricIndex].text !== 'undefined') {
            this._currentLyric = this._parsedLyrics[lyricIndex].text;
          } else {
            this._currentLyric = ""; 
          }
        } else {
          // No lyrics loaded or lyrics are empty
          this._currentLyric = "";
        }
      }
      else {
        clearInterval(localStorage.getItem("intervalid"));
        return html``;
      }


      return html`
      <ha-card>
        <div class="lyric fadeIn">
            ${this._currentLyric}
        </div>
      </ha-card>
    `;
  }

  _moreInfo_func() {
    var event = new Event("hass-action", {
      bubbles: true,
      composed: true,
    });
    event.detail = {
      config: this._actionConfig,
      action: "hold",
    };
    this.dispatchEvent(event);
  }

  _tap(e) {
    if(this._mouseIsDownTriggered == false) {
      setTimeout(() => {
        if (this._doubleClickTriggered == false) {
          if (this._tapAction == "more_info") {
            this._moreInfo_func();
          }
        }
      }, 200);
    }
  }

  _double_tap(e) {
    this._doubleClickTriggered = true;
    if (this._doubleTapAction == "more_info") {
      this._moreInfo_func();
    }
    setTimeout(() => {
      this._doubleClickTriggered = false;
    }, 500);
  }

  _mousedown(e) {
    this._mouseIsDown = true;
    setTimeout(() => {
      if(this._mouseIsDown) {
        this._mouseIsDownTriggered = true;
        if (this._holdAction == "more_info") {
          this._moreInfo_func();
        }
      }
    }, 1000);
  }

  _mouseup(e) {
    setTimeout(() => {
      this._mouseIsDown = false;
      this._mouseIsDownTriggered = false;
     }, 100);
  }

  static get styles() {

    return css`

      ha-card {
        padding: 10px;
      }

    * {
     box-sizing: border-box;
    }

    body {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .lyric {
        font-family: sans-serif;
        font-size: 16px;
        color: hsl(200, 20%, 25%);
        font-size: 2rem;
        font-weight: bolder;
        line-height: 1.5;
        text-align: center;
        text-transform: uppercase;
        margin: 0 auto;
        max-width: 300px;

    }

      .fadeIn {
        -webkit-animation-name: fadeIn;
        animation-name: fadeIn;
        -webkit-animation-duration: 1s;
        animation-duration: 1s;
        -webkit-animation-fill-mode: both;
        animation-fill-mode: both;
        }
        @-webkit-keyframes fadeIn {
        0% {opacity: 0;}
        100% {opacity: 1;}
        }
        @keyframes fadeIn {
        0% {opacity: 0;}
        100% {opacity: 1;}
        }
    `;
  }
}

customElements.define("karaoke-lyrics-card", KaraokeLyricsCard);

console.info(
  `%c karaoke-lyrics-card | Version 1 `,
  "color: white; font-weight: bold; background: #FF4F00",
);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "karaoke-lyrics-card",
    name: "Karaoke Lyrics Card",
    description: "Sing along to your favourite songs with this card!" // optional
});

function loadJSON(path, success, error) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        success(JSON.parse(xhr.responseText));
      }
      else {
        error(xhr);
      }
    }
  };
  xhr.open('GET', path, true);
  xhr.send();
}

function success(response) {
  if (response.hasOwnProperty('statusCode') && response.statusCode === 404 || !response.syncedLyrics) {
    localStorage.setItem("parsedLyrics", "");
    this._parsedLyrics = "";
    this._currentLyric = "";
    this._currentLyrics = "";
    console.log("No lyrics found or error, lyrics cleared.");
    return false;
  }
  // If lyrics are found and valid
  var parsedLyrics = parseLyric(response.syncedLyrics);
  if (parsedLyrics && parsedLyrics.length > 0) {
    localStorage.setItem("parsedLyrics", JSON.stringify(parsedLyrics));
    this._parsedLyrics = parsedLyrics; // Store the parsed array
    // currentLyric will be updated in render based on _parsedLyrics
  } else {
    localStorage.setItem("parsedLyrics", "");
    this._parsedLyrics = "";
    this._currentLyric = "";
    this._currentLyrics = "";
    console.log("Parsed lyrics were empty, lyrics cleared.");
  }
  return true;
}

function error(response) {
  console.log("Error fetching lyrics:", response);
  localStorage.setItem("parsedLyrics", "");
  this._parsedLyrics = "";
  this._currentLyric = "";
  this._currentLyrics = "";
}

function parseLyric(lrc) {
    // Ensure lrc is a string before attempting to split it
    if (typeof lrc !== 'string') {
        // If lrc is null, undefined, or any other non-string type,
        // return an empty array as there's nothing to parse.
        return []; 
    }

    // will match "[00:00.00] ooooh yeah!"
    // note: i use named capturing group
    const regex = /^\[(?<time>\d{2}:\d{2}(.\d{2})?)\](?<text>.*)/;

    // split lrc string to individual lines
    const lines = lrc.split("\n");

    const output = [];

    lines.forEach(line => {
        const match = line.match(regex);

        // if doesn't match, return.
        if (match == null) return;

        const { time, text } = match.groups;

        output.push({
            time: parseTime(time),
            text: text.trim()
        });
    });

    // parse formated time
    // "03:24.73" => 204.73 (total time in seconds)
    function parseTime(time) {
        const minsec = time.split(":");

        const min = parseInt(minsec[0]) * 60;
        const sec = parseFloat(minsec[1]);

        return min + sec;
    }

    return output;
}

function syncLyric(lyrics, time) {
    // Ensure lyrics is an array
    if (!Array.isArray(lyrics)) {
        return null;
    }

    const scores = [];
    lyrics.forEach((lyric, index) => {
        // Ensure lyric is an object and has a numeric 'time' property
        if (typeof lyric !== 'object' || lyric === null || typeof lyric.time !== 'number' || isNaN(lyric.time)) {
            return; // Skip this iteration
        }

        const score = time - lyric.time;
        if (score >= 0) {
            scores.push(score);
        }
    });

    if (scores.length === 0) {
        return null;
    }

    const closest = Math.min(...scores);
    // We need to find the original index from the lyrics array,
    // as scores only contains valid, positive scores.
    // This requires re-iterating or storing original indices.
    // For simplicity and to match original logic's direct use of scores.indexOf(closest):
    // We must ensure that the 'scores' array directly corresponds to valid lyrics.
    // The current 'scores.indexOf(closest)' will give an index into the 'scores' array,
    // which is NOT the same as the index in the original 'lyrics' array if some items were skipped.

    // Correct approach to get original index:
    // Store {score, originalIndex} and find the minimum score, then return originalIndex.
    // OR, find the index in the original array that produced that score.

    let bestMatchIndex = -1;
    let minPositiveScore = Infinity;

    lyrics.forEach((lyric, index) => {
        if (typeof lyric === 'object' && lyric !== null && typeof lyric.time === 'number' && !isNaN(lyric.time)) {
            const score = time - lyric.time;
            if (score >= 0 && score < minPositiveScore) {
                minPositiveScore = score;
                bestMatchIndex = index;
            }
        }
    });
    
    if (bestMatchIndex !== -1) {
        return bestMatchIndex;
    }

    return null; // No suitable lyric found
}
