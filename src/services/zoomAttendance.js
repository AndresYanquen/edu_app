const env = require('../config/env');

const DEFAULT_ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
const DEFAULT_ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token';

const normalizeBaseUrl = (value) => String(value || DEFAULT_ZOOM_API_BASE_URL).replace(/\/+$/, '');

const requireZoomConfig = () => {
  const missing = [];
  for (const key of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET']) {
    if (!env[key]) missing.push(key);
  }
  if (missing.length) {
    const error = new Error(`Zoom is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
};

const zoomFetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Zoom request failed with ${response.status}`);
    error.statusCode = response.status;
    error.zoomPayload = payload;
    throw error;
  }

  return payload || {};
};

const getZoomAccessToken = async () => {
  requireZoomConfig();
  const tokenUrl = new URL(env.ZOOM_OAUTH_TOKEN_URL || DEFAULT_ZOOM_OAUTH_TOKEN_URL);
  tokenUrl.searchParams.set('grant_type', 'account_credentials');
  tokenUrl.searchParams.set('account_id', env.ZOOM_ACCOUNT_ID);

  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const payload = await zoomFetchJson(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  if (!payload.access_token) {
    const error = new Error('Zoom token response did not include access_token');
    error.statusCode = 502;
    throw error;
  }
  return payload.access_token;
};

const normalizeParticipant = (participant, source) => ({
  zoomUserId: participant.user_id || null,
  zoomParticipantId: participant.id || participant.participant_user_id || null,
  participantUuid: participant.participant_uuid || null,
  name: participant.name || participant.user_name || '',
  email: participant.user_email || participant.email || '',
  joinTime: participant.join_time || null,
  leaveTime: participant.leave_time || null,
  durationSeconds:
    participant.duration === undefined || participant.duration === null || participant.duration === ''
      ? null
      : Number(participant.duration),
  status: participant.status || '',
  source,
});

const getEndedMeetingParticipants = async (meetingUuid) => {
  const token = await getZoomAccessToken();
  const baseUrl = normalizeBaseUrl(env.ZOOM_API_BASE_URL);
  const participants = [];
  let nextPageToken = '';

  do {
    const url = new URL(`${baseUrl}/report/meetings/${encodeURIComponent(meetingUuid)}/participants`);
    url.searchParams.set('page_size', '30');
    url.searchParams.set('include_fields', 'registrant_id');
    if (nextPageToken) {
      url.searchParams.set('next_page_token', nextPageToken);
    }

    const payload = await zoomFetchJson(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    participants.push(...(Array.isArray(payload.participants) ? payload.participants : []));
    nextPageToken = payload.next_page_token || '';
  } while (nextPageToken);

  return participants.map((participant) => normalizeParticipant(participant, 'ended'));
};

const getLiveMeetingParticipants = async (meetingId) => {
  const token = await getZoomAccessToken();
  const baseUrl = normalizeBaseUrl(env.ZOOM_API_BASE_URL);
  const url = `${baseUrl}/metrics/meetings/${encodeURIComponent(meetingId)}/participants`;
  const payload = await zoomFetchJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (Array.isArray(payload.participants) ? payload.participants : []).map((participant) =>
    normalizeParticipant(participant, 'live'),
  );
};

const getZoomParticipants = async ({ mode = 'auto', meetingId, meetingUuid }) => {
  if (mode === 'ended') {
    if (!meetingUuid) {
      const error = new Error('meetingUuid is required for ended Zoom import');
      error.statusCode = 400;
      throw error;
    }
    return { mode: 'ended', participants: await getEndedMeetingParticipants(meetingUuid) };
  }

  if (mode === 'live') {
    if (!meetingId) {
      const error = new Error('meetingId is required for live Zoom import');
      error.statusCode = 400;
      throw error;
    }
    return { mode: 'live', participants: await getLiveMeetingParticipants(meetingId) };
  }

  if (meetingUuid) {
    try {
      return { mode: 'ended', participants: await getEndedMeetingParticipants(meetingUuid) };
    } catch (err) {
      if (!meetingId) throw err;
    }
  }

  if (!meetingId) {
    const error = new Error('meetingId or meetingUuid is required for Zoom import');
    error.statusCode = 400;
    throw error;
  }
  return { mode: 'live', participants: await getLiveMeetingParticipants(meetingId) };
};

module.exports = {
  getZoomParticipants,
  normalizeParticipant,
};
