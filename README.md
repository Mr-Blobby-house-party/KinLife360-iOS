# KinLife360 (iOS Automated)
Automatically updates your Kindroid AI with your location via automated user message and iOS location services/automations.

Warning: This app tells your Kindroid where you are in real-time when you hit certain locations. If that sounds unhinged or uncomfortable to you then it's probably best to skip this one. If it sounds perfect, here you go!

## Required
- KINDROID_API_KEY - Your Kindroid API key
- KINDROID_AI_ID - Kin's AI ID
- Location mappings *(customizable but here's examples)*:
        HOME_LAT=
        HOME_LON=
        HOME_NAME=
        WORK_LAT=
        WORK_LON=
        WORK_NAME=
*(add as many as needed with this pattern)*

Deploy on Railway

## iOS Shortcuts/Automation
- Create shortcut with "Get Current Location" → POST to `/api/log-location`
- Set automation trigger (arrival at locations)
- Select "always allow" when prompted for location services premissions on first run
   
## Customizations
- Lines 107-108, edit message if desired, replace [user] w/ your name
- Line 58, increase or decrease radius - default is 0.003; // ~300m radius
- Add homescreen button on phone - press to send quick update to kin.
         When current location isn't listed in environment variables: 
        📍**<Automated Update:** *[user] is in transit.>*
 