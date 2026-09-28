const EVENT = 'marketlink:local-avatar-updated';
const MAX_DATA_URL_LENGTH = 1_500_000;

function storageKey(profileId: string): string {
  return `marketlink:profile-avatar:${profileId}`;
}

/** Read the browser-local avatar for a profile. The server photo is kept as a fallback. */
export function readLocalAvatar(profileId: string): string | null {
  try {
    const value = window.localStorage.getItem(storageKey(profileId));
    return value?.startsWith('data:image/jpeg;base64,') ? value : null;
  } catch {
    return null;
  }
}

/** Shrink a selected photo and store it on this device, keeping it small for localStorage. */
export async function saveLocalAvatar(profileId: string, file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This photo could not be opened. Choose another image.'));
      element.src = source;
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 512 / longestSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error('This photo is too detailed to save in browser storage. Choose another photo.');

    try {
      window.localStorage.setItem(storageKey(profileId), dataUrl);
    } catch {
      throw new Error('This browser is out of storage space for the profile photo.');
    }
    window.dispatchEvent(new Event(EVENT));
    return dataUrl;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function localAvatarEventName(): string {
  return EVENT;
}
