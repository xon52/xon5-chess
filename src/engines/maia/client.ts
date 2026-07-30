import type { InferenceSession, Tensor } from 'onnxruntime-web'

import type { PlayEngine } from '@/engines/types'
import { getMaiaConfig, maiaOnnxUrl } from '@/engines/maia/configs'
import { encodeMaiaInput } from '@/engines/maia/encode'
import { pickMoveFromPolicy } from '@/engines/maia/policy'

type OrtModule = {
  InferenceSession: {
    create(path: string): Promise<InferenceSession>
  }
  Tensor: new (type: string, data: Float32Array, dims: number[]) => Tensor
}

let ortPromise: Promise<OrtModule | null> | null = null
let warnedMissing = false

const loadOrt = async (): Promise<OrtModule | null> => {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web')
      .then((m) => m as unknown as OrtModule)
      .catch((err) => {
        console.warn('[maia] onnxruntime-web unavailable', err)
        return null
      })
  }
  return ortPromise
}

/**
 * Maia play engine via ONNX Runtime Web.
 * Soft-fails (null move) when weights or runtime are missing.
 */
export const createMaiaPlayEngine = (): PlayEngine => {
  const sessions = new Map<number, InferenceSession>()

  const unloadAll = () => {
    sessions.clear()
  }

  const getSession = async (rating: number): Promise<InferenceSession | null> => {
    const existing = sessions.get(rating)
    if (existing) {
      return existing
    }
    const ort = await loadOrt()
    if (!ort) {
      return null
    }
    const url = maiaOnnxUrl(rating)
    try {
      const session = await ort.InferenceSession.create(url)
      sessions.set(rating, session)
      return session
    } catch (err) {
      if (!warnedMissing) {
        warnedMissing = true
        console.warn(
          '[maia] ONNX weights not loaded — run `pnpm fetch:maia` before testing Maia',
          err,
        )
      }
      return null
    }
  }

  return {
    id: 'maia',
    playSearch: async ({ fen, configId }) => {
      const cfg = getMaiaConfig(configId)
      const ort = await loadOrt()
      const session = await getSession(cfg.rating)
      if (!ort || !session) {
        return null
      }

      const input = encodeMaiaInput(fen)
      const tensor = new ort.Tensor('float32', input, [1, 112, 8, 8])
      const inputName = session.inputNames[0] ?? 'input'
      const feeds: Record<string, Tensor> = { [inputName]: tensor }
      const out = await session.run(feeds)
      const policyOut =
        out.pol_flat ?? out[session.outputNames.find((n) => n.includes('pol')) ?? ''] ?? null
      if (!policyOut) {
        console.warn('[maia] missing policy output')
        return null
      }
      const data = policyOut.data as Float32Array
      return pickMoveFromPolicy(fen, data)
    },
    notifyNewGame: () => {},
    stop: () => {},
    stopAndDrain: async () => {
      unloadAll()
    },
  }
}
