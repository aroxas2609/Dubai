# Dubai Trip Backend

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Google Service Account:**
   - Create a Google Cloud project and enable the Google Sheets API.
   - Create a service account and download the JSON credentials file.
   - Place the JSON file in the `backend` directory and name it `service-account.json` (or update the `.env` accordingly).
   - Share your Google Sheet with the service account email (read-only access).

3. **Environment Variables:**
   Create a `.env` file in the `backend` directory with the following content:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON=service-account.json
   SHEET_ID=your_google_sheet_id_here
   SHEET_RANGE=Sheet1
   BASIC_AUTH_USER=yourusername
   BASIC_AUTH_PASS=yourpassword
   PORT=3001
   ```
   - Replace `your_google_sheet_id_here` with your actual Google Sheet ID.
   - Set your desired username and password for basic authentication.

4. **Run the server:**
   ```bash
   node index.js
   ```

## API
- `GET /api/itinerary` (requires basic auth)
  - Returns the itinerary as an array of rows from the Google Sheet. 