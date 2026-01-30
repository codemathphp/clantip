import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * Ensure there is a canonical users/{uid} document and index mappings.
 * - If users/{uid} exists, return it
 * - Else, if uid_index/{uid} -> phone exists and users/{phone} legacy doc exists,
 *   copy legacy data into users/{uid], create phone_index and mark legacy migrated
 * - Else, if phoneProvided, create users/{uid} with phoneE164 and set indices
 */
export async function ensureUserRecord(uid: string, phoneProvided?: string) {
  if (!uid) throw new Error('Missing uid')

  const userByUidRef = doc(db, 'users', uid)
  const userByUidSnap = await getDoc(userByUidRef)
  if (userByUidSnap.exists()) {
    const existing = userByUidSnap.data() as any
    return { uid, phone: existing.phone || existing.phoneE164 || '', data: existing }
  }

  // Check uid_index for existing phone mapping
  const uidIndexRef = doc(db, 'uid_index', uid)
  const uidIndexSnap = await getDoc(uidIndexRef)
  let phoneE164: string | undefined = undefined

  if (uidIndexSnap.exists()) {
    phoneE164 = (uidIndexSnap.data() as any).phoneE164
  }

  // If we have a legacy users/{phoneE164} doc, migrate it
  if (phoneE164) {
    const legacyRef = doc(db, 'users', phoneE164)
    const legacySnap = await getDoc(legacyRef)
    if (legacySnap.exists()) {
      const legacyData = legacySnap.data() as any
      // Copy legacy fields into users/{uid}
      const newData = { ...legacyData, phoneE164, phone: phoneE164 || legacyData.phone || '', authUid: uid, migrated: true }
      await setDoc(userByUidRef, newData)
      // Ensure indexing documents
      await setDoc(uidIndexRef, { phoneE164 })
      const phoneIndexRef = doc(db, 'phone_index', phoneE164)
      await setDoc(phoneIndexRef, { uid })
      // Mark legacy as migrated:true (non-destructive)
      try { await updateDoc(legacyRef, { migrated: true }) } catch (e) { /* ignore */ }
      return { uid, phone: phoneE164, data: newData }
    }
  }

  // No uid_index mapping or legacy doc. Use provided phone if available.
  if (phoneProvided) {
    const phoneRef = doc(db, 'users', phoneProvided)
    const phoneSnap = await getDoc(phoneRef)
    let baseData: any = { phoneE164: phoneProvided, phone: phoneProvided || '', authUid: uid }
    if (phoneSnap.exists()) {
      baseData = { ...(phoneSnap.data() as any), phoneE164: phoneProvided, phone: phoneProvided || (phoneSnap.data() as any).phone || '', authUid: uid }
      try { await updateDoc(phoneRef, { migrated: true }) } catch (e) { /* ignore */ }
    }
    await setDoc(userByUidRef, baseData)
    await setDoc(uidIndexRef, { phoneE164: phoneProvided })
    const phoneIndexRef = doc(db, 'phone_index', phoneProvided)
    await setDoc(phoneIndexRef, { uid })
    return { uid, phone: phoneProvided, data: baseData }
  }

  // Nothing to do: create minimal users/{uid} placeholder
  const minimal = { authUid: uid, createdAt: new Date(), phone: '' }
  await setDoc(userByUidRef, minimal)
  await setDoc(uidIndexRef, { phoneE164: null })
  return { uid, phone: '', data: minimal }
}
