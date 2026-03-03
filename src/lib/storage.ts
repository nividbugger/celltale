import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadReportPDF(
  appointmentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `reports/${appointmentId}/${timestamp}_${safeName}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(pct)
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      },
    )
  })
}
