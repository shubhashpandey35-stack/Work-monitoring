// Decides exactly which user fields may leave the server.
// Password is never included. Location is included ONLY if the employee gave consent.
export const toPublicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  profilePhoto: u.profilePhoto || "",
  role: u.role,
  status: u.status,
  lastActivity: u.lastActivity || null,
  statusUpdatedAt: u.statusUpdatedAt || null,
  locationConsent: !!u.locationConsent,
  location:
    u.locationConsent && u.location && u.location.latitude != null
      ? {
          latitude: u.location.latitude,
          longitude: u.location.longitude,
          updatedAt: u.location.updatedAt,
        }
      : null,
  createdAt: u.createdAt,
});
