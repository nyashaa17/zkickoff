Here is a comprehensive prompt you can use (e.g., in Google AI Studio, ChatGPT, or Claude) to jumpstart your Android app development using Jetpack Compose.

---

**Copy and paste the prompt below:**

```text
Act as an Expert Android Developer. I want you to build an Android App using Kotlin and Jetpack Compose that replicates the functionality of my current football streaming website. 

### Tech Stack
- **Language**: Kotlin
- **UI Toolkit**: Jetpack Compose (Material 3)
- **Networking**: Retrofit 2 + OkHttp + Moshi (or Kotlinx Serialization)
- **Asynchrony**: Kotlin Coroutines & Flow
- **Architecture**: MVVM (Model-View-ViewModel)
- **Dependency Injection**: Hilt (optional but preferred)
- **Navigation**: Jetpack Navigation Compose
- **Image Loading**: Coil
- **Streaming/Web Views**: Accompanist WebView (or native Accompanist equivalent) for rendering the iframe streaming video.

### Functionality & UI Layouts
1. **Home Screen**:
   - A top app bar with the app logo/name ("ZimKickOff").
   - A horizontal scrolling Date Selector strip formatted with `YYYYMMDD` (Today, Yesterday, Tomorrow, and next days).
   - A Tab Row below the date selector with Tabs: "LIVE", "TODAY", "UPCOMING", "FINISHED".
   - A list of Football Matches categorized by League (like English Premier League, ZPSL, etc.).
   - Each Match Card should show Home Team vs Away Team with their logos, the score, match status (LIVE, NS, FT, minute), and kickoff time.

2. **Match Details / Watch Screen**:
   - When a user clicks a Match Card, take them to the details screen.
   - Show the two teams, current score, and minute.
   - Tab Layout with: `STREAM`, `STATS`, `COMMENTARY`.
   - **Stream Tab**: Load dynamic match server buttons. When a button is clicked, open a WebView embedded in Native Compose that loads the respective `embedUrl`.
   - **Stats Tab**: Display top scorers and statistics.
   - **Commentary Tab**: A vertical timeline of live match commentary.

### Data Models & API Endpoints
You must use these exact API endpoints to populate the app:

**1. Live Scores (Matches List)**
- **Endpoint**: `GET https://king.totalsportslive.co.zw/api/livescore?date={YYYYMMDD}&t={timestamp}`
- **JSON Structure**: Returns an object containing a `Stages` array. Each `Stage` contains `Snm` (Stage/League Name), `Cnm` (Country) and an `Events` array.
- **Event Object**: Has `Eid` (Match ID), `T1` & `T2` (Home/Away Arrays containing `Nm` (Name) and `ID`), `Esd` (Start datetime `YYYYMMDDHHMMSS`), `Tr1` & `Tr2` (Scores), `Eps` (Status like '1H', 'FT', 'NS'), `Ela` (Elapsed minute).

**2. Match Button Stream Links**
- **Endpoint**: `GET https://app.totalsportss.online/match-buttons/{matchId}`
- **Note**: This returns HTML. You will need to write a simple regex or use JSoup in the Android Repository layer to parse the `<a href="...">` tags and extract the `stream` and `fixture` URL params. The target embed url is `https://king.totalsportss.online/embed?fixture={fixture}&stream={stream}`.

**3. Match Commentary**
- **Endpoint**: `GET https://api.totalsportss.online/matches/{matchId}`
- **JSON Structure**: Expects an object containing `liveCommentary` (array of `{time, text}`) and `manualCommentary` arrays.

**4. Stats**
- **Endpoint**: `GET https://cap.totalsportslive.co.zw/api/stats?competition={competition}&dateOrCategory={dateOrCategory}&sport=football`
- **JSON Structure**: Returns JSON array of category objects, each holding a `players` array.

### Initial Request
To get started, please generate:
1. The Retrofit API Interface matching the endpoints above.
2. The Data Classes (using `@JsonClass(generateAdapter = true)` for Moshi).
3. The Match Repository class that fetches and parses the Livescore API into a clean usable Kotlin `Match` domain model.
4. The View Model holding the state for the Home Screen.
```

---

### Recommended Libraries to include in your Android `build.gradle.kts`:
- `androidx.compose.ui:ui` / `androidx.compose.material3:material3`
- `com.squareup.retrofit2:retrofit:2.9.0`
- `com.squareup.retrofit2:converter-moshi:2.9.0` (or `converter-gson`)
- `com.squareup.moshi:moshi-kotlin:1.15.0`
- `io.coil-kt:coil-compose:2.6.0`
- `org.jsoup:jsoup:1.17.2` (To easily parse the match-buttons HTML stream links)
- `androidx.navigation:navigation-compose:2.7.7`
