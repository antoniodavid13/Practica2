/* Ayudas para los aparatos en 3D: pantallas pintadas en un canvas y clavijas con cable. */

// Pantalla dinámica: un canvas pintado como textura sobre el plano con UV del modelo
export function screen(THREE, mesh, w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.anisotropy = 16 // la pantalla se ve inclinada al girar la vista: filtrado máximo
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  if (mesh) mesh.material = mat
  return { canvas, g: canvas.getContext('2d'), tex, dispose() { tex.dispose(); mat.dispose() } }
}

// Clavija banana con su cable, que sale hacia abajo del aparato. Coordenadas en metros.
export function plug(THREE, color) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.018, 24), mat)
  body.rotation.x = Math.PI / 2
  body.position.z = 0.009
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0042, 0.012, 24), mat)
  grip.rotation.x = Math.PI / 2
  grip.position.z = 0.024
  group.add(body, grip)
  let cable = null
  return {
    group,
    // Coloca la clavija en `at` (centro del borne, en la cara) y tiende el cable hasta `to`
    place(at, to) {
      group.position.copy(at)
      if (cable) { group.remove(cable); cable.geometry.dispose() }
      const s = new THREE.Vector3(0, 0, 0.03)
      const end = to.clone().sub(at)
      const curve = new THREE.CatmullRomCurve3([s, new THREE.Vector3(0, -0.01, 0.045), new THREE.Vector3(end.x * 0.4, end.y * 0.55, 0.05), end])
      cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0019, 10, false), mat)
      group.add(cable)
    },
    dispose() { if (cable) cable.geometry.dispose(); body.geometry.dispose(); grip.geometry.dispose(); mat.dispose() },
  }
}
