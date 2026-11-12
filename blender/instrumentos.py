"""Construye en Blender el multímetro Promax PD-695 y la fuente Promax FAC-662B.

Referencias: la foto `public/Voltimetro.jpeg` y la Figura 2.1 del guion (`public/Figura-2.1-Fuente.png`).
Medidas en milímetros, a escala real. La cara frontal mira a -Y; el alto va en +Z.
Las piezas con las que se interactúa en la web llevan nombre propio y el origen en su eje de giro:

  PD695_Selector, PD695_Btn_POWER, PD695_LCD, PD695_Jack_20A | _mA | _COM | _V
  FAC_Knob_S1_Coarse | _S1_Fine | _S1_Ilim | _S2_Coarse | _S2_Fine | _S2_Ilim
  FAC_Btn_V_S1 | _V_S2 | _INDEP | _TRACK | _SERIES | _PARALL | _A_S1 | _A_S2
  FAC_Switch_LINE, FAC_Disp_V, FAC_Disp_A, FAC_Term_7 … FAC_Term_14

Uso, desde la consola de Blender o el MCP:
  exec(open(r'C:/wamp64/www/htdocs/Practica2/blender/instrumentos.py', encoding='utf-8').read())
  build_all(); export_all()
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001
HERE = r'C:/wamp64/www/htdocs/Practica2'
OUT = os.path.join(HERE, 'public', 'models')
FONT_DIR = r'C:/Windows/Fonts'


# ---------------------------------------------------------------- utilidades
def lin(h):
    """Color sRGB hexadecimal a lineal."""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hexcol, rough=0.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    col = (*lin(hexcol), 1)
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = col
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = col
    return m


def font(fname):
    path = os.path.join(FONT_DIR, fname)
    if os.path.exists(path):
        return bpy.data.fonts.load(path, check_existing=True)
    return None


def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def mesh_obj(name, bm, coll, mats, loc=(0, 0, 0), parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ob.location = Vector(loc) * MM
    coll.objects.link(ob)
    if parent:
        ob.parent = parent
        ob.location = Vector(loc) * MM - parent.location if parent.parent is None else Vector(loc) * MM
    return ob


def rrect_pts(w, h, r, seg=6):
    """Contorno de un rectángulo redondeado en el plano XZ (antihorario visto desde -Y)."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cz, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def prism(pts, depth, bevel=0.0):
    """Extruye un contorno XZ desde y=0 hacia +Y (hacia atrás). Devuelve bmesh en mm."""
    bm = bmesh.new()
    vs = [bm.verts.new((x * MM, 0, z * MM)) for x, z in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0, depth * MM, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel:
        front = [e for e in bm.edges if all(abs(v.co.y) < 1e-7 for v in e.verts)]
        bmesh.ops.bevel(bm, geom=front, offset=bevel * MM, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
    return bm


def rrect(name, coll, mat, w, h, r, depth, x, z, y=0.0, bevel=0.0, parent=None):
    return mesh_obj(name, prism(rrect_pts(w, h, r), depth, bevel), coll, [mat], (x, y, z), parent)


def circle_pts(r, seg=32, star=0.0):
    pts = []
    n = seg * (2 if star else 1)
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r - (star if (star and i % 2) else 0)
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


def cyl(name, coll, mat, r, depth, x, z, y=0.0, seg=32, star=0.0, bevel=0.0, parent=None):
    return mesh_obj(name, prism(circle_pts(r, seg, star), depth, bevel), coll, [mat], (x, y, z), parent)


def box(name, coll, mat, w, d, h, x, y, z, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w * MM, d * MM, h * MM), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel * MM, segments=4, profile=0.5, affect='EDGES', clamp_overlap=True)
    return mesh_obj(name, bm, coll, [mat], (x, y, z))


# ------------------------------------------------------------- rótulos
class Labels:
    """Acumula textos y líneas y los une en una malla por material."""

    def __init__(self, prefix, coll, y0=0.0):
        self.prefix, self.coll, self.groups, self.y0 = prefix, coll, {}, y0

    def _add(self, mat, me, mw):
        me.transform(mw)
        self.groups.setdefault(mat.name, (mat, []))[1].append(me)

    def text(self, s, size, x, z, mat, y=-0.15, align='CENTER', fnt=None, rot=0.0, valign='CENTER'):
        y += self.y0
        cu = bpy.data.curves.new('tmp_txt', 'FONT')
        cu.body = s
        cu.size = size * MM
        cu.align_x = align
        cu.align_y = valign
        if fnt:
            cu.font = fnt
        ob = bpy.data.objects.new('tmp_txt', cu)
        self.coll.objects.link(ob)
        ob.rotation_euler = (math.radians(90), math.radians(rot), 0)
        ob.location = (x * MM, y * MM, z * MM)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        mw = ob.matrix_world.copy()
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        self._add(mat, me, mw)

    def poly(self, pts, mat, y=-0.12):
        """Polígono plano relleno (líneas, flechas, marcas)."""
        y += self.y0
        bm = bmesh.new()
        vs = [bm.verts.new((px * MM, y * MM, pz * MM)) for px, pz in pts]
        f = bm.faces.new(vs)
        if f.normal.y > 0:
            f.normal_flip()
        me = bpy.data.meshes.new('tmp_poly')
        bm.to_mesh(me)
        bm.free()
        self._add(mat, me, Matrix.Identity(4))

    def line(self, x0, z0, x1, z1, wid, mat, y=-0.12):
        dx, dz = x1 - x0, z1 - z0
        n = math.hypot(dx, dz) or 1
        ox, oz = -dz / n * wid / 2, dx / n * wid / 2
        self.poly([(x0 + ox, z0 + oz), (x0 - ox, z0 - oz), (x1 - ox, z1 - oz), (x1 + ox, z1 + oz)], mat, y)

    def polyline(self, pts, wid, mat, y=-0.12):
        for a, b in zip(pts, pts[1:]):
            self.line(*a, *b, wid, mat, y)

    def frame(self, x0, z0, x1, z1, wid, mat, y=-0.12):
        self.polyline([(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)], wid, mat, y)

    def dc(self, x, z, w, mat, y=-0.12):
        """Símbolo de continua: línea llena y debajo una discontinua."""
        self.line(x - w / 2, z + 0.6, x + w / 2, z + 0.6, 0.5, mat, y)
        for i in range(3):
            a = x - w / 2 + i * w / 3
            self.line(a, z - 0.6, a + w / 3 * 0.6, z - 0.6, 0.5, mat, y)

    def finish(self):
        out = []
        for name, (mat, meshes) in self.groups.items():
            bm = bmesh.new()
            for me in meshes:
                bm.from_mesh(me)
                bpy.data.meshes.remove(me)
            out.append(mesh_obj(f'{self.prefix}_Rotulos_{name}', bm, self.coll, [mat]))
        return out


def uv_plane(name, coll, mat, w, h, x, z, y):
    """Plano con UV de 0 a 1, para pintar la pantalla con una textura dinámica en la web."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((px * MM, 0, pz * MM)) for px, pz in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]]
    f = bm.faces.new(vs)
    if f.normal.y > 0:
        f.normal_flip()
    for loop in f.loops:
        co = loop.vert.co
        loop[uv].uv = (co.x / (w * MM) + 0.5, co.z / (h * MM) + 0.5)
    return mesh_obj(name, bm, coll, [mat], (x, y, z))


def empty(name, coll, x, y, z, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.01
    e.location = (x * MM, y * MM, z * MM)
    coll.objects.link(e)
    if parent:
        e.parent = parent
    return e


def parent_keep(child, parent):
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = mw


# ------------------------------------------------------------ limpieza
def clear_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        return
    for ob in list(c.objects):
        data = ob.data
        bpy.data.objects.remove(ob)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
    bpy.data.collections.remove(c)


def clear_default():
    for n in ('Cube', 'Light', 'Camera'):
        ob = bpy.data.objects.get(n)
        if ob:
            bpy.data.objects.remove(ob)


def diode(L, x, z, mat):
    """Símbolo de continuidad y diodo: •))) ▶|"""
    L.text('•)))', 2.2, x - 3.5, z, mat)
    L.poly([(x, z - 1.6), (x, z + 1.6), (x + 2.8, z)], mat)
    L.line(x + 2.9, z - 1.7, x + 2.9, z + 1.7, 0.5, mat)
    L.line(x - 0.8, z, x + 4.2, z, 0.35, mat)


# ======================================================== MULTÍMETRO PD-695
DIAL_LABELS = ['1000', '400', '40', '4', '400m', '400m', '40m', '20A', '400m', '40m', '20A',
               '40µ', '4µ', '400n', '40n', '4n', '400', '4k', '40k', '400k', '4M', '40M',
               '', 'PNP', 'NPN', 'LOGIC', 'kHz', '400m', '4', '40', '400', '750']
STEP = 360 / 32
DIAL_Z = -18.0     # centro del selector


def build_pd695():
    clear_collection('PD695')
    co = collection('PD695')
    bold, reg = font('arialbd.ttf'), font('arial.ttf')

    yel = material('PD_Amarillo', '#F2C114', 0.55)
    yel2 = material('PD_AmarilloPanel', '#F4C51E', 0.45)
    gray = material('PD_GrisBisel', '#C4C6C2', 0.6)
    lcd = material('PD_LCD', '#929A8B', 0.35)
    btn = material('PD_Boton', '#8E9393', 0.5)
    ink = material('PD_Tinta', '#1C1A16', 0.6)
    red = material('PD_RojoBorne', '#A3201A', 0.35)
    blk = material('PD_NegroBorne', '#191919', 0.35)
    hole = material('PD_Hueco', '#050505', 0.9)
    metal = material('PD_Metal', '#B9B9B9', 0.3, 0.8)
    redink = material('PD_TintaRoja', '#C2271C', 0.6)

    root = empty('PD695', co, 0, 0, 0)

    # Funda y panel
    body = rrect('PD695_Funda', co, yel, 96, 218, 14, 38, 0, -2, y=-2, bevel=4)
    panel = rrect('PD695_Panel', co, yel2, 84, 162, 5, 1.2, 0, -27, y=-3)
    bezel = rrect('PD695_Bisel', co, gray, 76, 52, 6, 1.4, 0, 72, y=-3.2, bevel=0.6)
    lcdo = uv_plane('PD695_LCD', co, lcd, 64, 38, 0, 72, -3.45)

    L = Labels('PD695', co, y0=-3.0)

    # Botones POWER y MAX
    bp = rrect('PD695_Btn_POWER', co, btn, 15, 7.5, 3.75, 3, -28, 35, y=-5.2, bevel=1)
    bm_ = rrect('PD695_Btn_MAX', co, btn, 15, 7.5, 3.75, 3, 28, 37, y=-5.2, bevel=1)
    L.text('POWER', 3.4, -27, 28.5, ink, fnt=bold)
    L.text('MAX', 3.4, 28, 30.5, ink, fnt=bold)
    L.text('TÜV SAFETY APPROVED TO IEC1010', 2.6, 0, 42, ink, fnt=bold)
    L.text('CE', 6, -8, 35, ink, fnt=bold)
    L.text('GS', 4.4, 8, 35, ink, fnt=bold)
    L.frame(4, 31.5, 12, 38.5, 0.5, ink)
    L.text('AUTO POWER OFF', 2.4, -22, 23.5, ink, fnt=bold)

    # Escala del selector: marcas y rótulos
    r_tick0, r_tick1, r_lab = 23.5, 26.5, 29.2
    for i, lab in enumerate(DIAL_LABELS):
        a = math.radians(STEP / 2 + i * STEP)
        s, c = math.sin(a), math.cos(a)
        L.line(r_tick0 * s, DIAL_Z + r_tick0 * c, r_tick1 * s, DIAL_Z + r_tick1 * c, 1.3, ink)
        x, z = r_lab * s, DIAL_Z + r_lab * c
        align = 'CENTER' if abs(s) < 0.35 else ('LEFT' if s > 0 else 'RIGHT')
        if abs(s) >= 0.35:
            x += 0.6 if s > 0 else -0.6
        if lab:
            L.text(lab, 2.9, x, z, ink, align=align, fnt=bold)
        else:
            diode(L, x - 4.5, z, ink)
    # Separadores: entre 750 y 1000 arriba, y entre 4n y 400 abajo, como en el aparato
    L.line(0, DIAL_Z + r_tick1, 0, DIAL_Z + 34, 0.5, ink)
    L.line(0, DIAL_Z - r_tick1, 0, DIAL_Z - 34, 0.5, ink)
    # Símbolos de zona
    L.text('V', 4, -30, 20, ink, fnt=bold); L.text('~', 4, -26.5, 20.5, ink, fnt=bold)
    L.text('V', 4, 27, 22, ink, fnt=bold); L.dc(31.6, 22, 4.2, ink)
    L.text('A', 4, 37.5, 4, ink, fnt=bold); L.dc(37.5, -0.6, 3.6, ink)
    L.text('A', 4, 37.5, -12, ink, fnt=bold); L.text('~', 3.4, 37.5, -16.2, ink, fnt=bold)
    L.text('F', 4, 33, -40, ink, fnt=bold)
    L.text('Ω', 4.2, -35, -47, ink, fnt=bold)
    L.text('hFE', 3.2, -30, -53.5, ink, fnt=bold)
    L.text('Cx', 3.4, 24, -52, ink, fnt=bold)

    # Zócalo hFE y ranura Cx
    rrect('PD695_hFE', co, yel, 14, 4.5, 1, 1, -30, -58.5, y=-3.6)
    for k in range(4):
        cyl(f'PD695_hFE_{k}', co, hole, 0.6, 0.3, -34.2 + k * 2.8, -58.5, y=-3.8, seg=12)
    L.text('E B C E', 2, -30, -63, ink, fnt=bold)
    rrect('PD695_Cx', co, metal, 30, 4.5, 0.8, 0.8, 24, -57, y=-3.5)
    rrect('PD695_Cx_hueco', co, hole, 12, 2.2, 0.5, 0.5, 17.5, -57, y=-3.8)
    rrect('PD695_Cx_hueco2', co, hole, 12, 2.2, 0.5, 0.5, 30.5, -57, y=-3.8)
    L.text('DISCHARGE CAPACITOR BEFORE CONNECTING', 1.6, 12, -62.5, ink, fnt=bold)
    L.line(-42, -66, 42, -66, 0.45, ink)

    # Selector (gira alrededor de su eje Y; 0 = posición «1000 V» arriba)
    sel = empty('PD695_Selector', co, 0, -3, DIAL_Z, parent=None)
    disc = cyl('PD695_Selector_Disco', co, yel, 21, 4, 0, DIAL_Z, y=-7, seg=64, bevel=0.8)
    bar = rrect('PD695_Selector_Mango', co, yel, 10, 42, 4, 5, 0, DIAL_Z, y=-12, bevel=1.5)
    tip = rrect('PD695_Selector_Indice', co, ink, 1, 6, 0.3, 0.3, 0, DIAL_Z + 17, y=-12.15)
    for ob in (disc, bar, tip):
        parent_keep(ob, sel)

    # Bornes
    jx = {'20A': -31, 'mA': -10.5, 'COM': 10.5, 'V': 31}
    JZ = -80
    for k, x in jx.items():
        ring = cyl(f'PD695_Jack_{k}', co, blk if k == 'COM' else red, 6.2, 3, x, JZ, y=-5.5, seg=40, bevel=0.6)
        h = cyl(f'PD695_Jack_{k}_hueco', co, hole, 2.4, 1, x, JZ, y=-5.7, seg=24)
        parent_keep(h, ring)
        cyl(f'PD695_Jack_{k}_base', co, blk, 8, 2, x, JZ, y=-3.4, seg=40)
    L.text('20A', 4.4, jx['20A'], JZ + 10, ink, fnt=bold)
    L.text('mA', 4.4, jx['mA'], JZ + 10, ink, fnt=bold)
    L.text('COM', 4.4, jx['COM'], JZ + 10, ink, fnt=bold)
    L.text('VΩHz', 4.0, jx['V'] + 1, JZ + 10, ink, fnt=bold)
    L.text('20A MAX', 2.2, -21, -91, ink, fnt=bold); L.text('FUSED', 2.2, -21, -94, ink, fnt=bold)
    L.text('400mA MAX', 2.2, 0, -89, ink, fnt=bold); L.text('FUSED', 2.2, 0, -92, ink, fnt=bold)
    L.text('1000V⎓ MAX', 2.0, 21, -89, ink, fnt=bold); L.text('750V~', 2.0, 21, -92, ink, fnt=bold)
    L.polyline([(-31, -86.5), (-31, -95.5), (-11, -95.5), (-11, -86.5)], 0.45, ink)
    L.polyline([(-10.5, -86.5), (-10.5, -93.5), (10.5, -93.5), (10.5, -86.5)], 0.45, ink)
    L.polyline([(10.5, -86.5), (10.5, -93.5), (31, -93.5), (31, -86.5)], 0.45, ink)
    # triángulos de aviso
    for x in (-20.5, 0):
        L.polyline([(x - 2.4, JZ - 2), (x + 2.4, JZ - 2), (x, JZ + 2.2), (x - 2.4, JZ - 2)], 0.45, ink)
        L.text('!', 2.6, x, JZ - 0.5, ink, fnt=bold)
    L.poly([(21 - 2.6, JZ - 2), (21 + 2.6, JZ - 2), (21, JZ + 2.6)], redink)
    L.text('CAT. II', 1.8, 31, JZ + 6.3, ink, fnt=bold)

    # Pie
    L.text('MULTIMETER  PD-695', 4.0, 15, -102.5, ink, fnt=bold)
    L.frame(-40, -105.5, -17, -99.5, 0.5, redink)
    L.poly([(-38.5, -104.5), (-34.5, -104.5), (-36.5, -100.5)], redink)
    L.text('PROMAX', 3.0, -25, -102.5, redink, fnt=bold)
    L.line(-42, -97.8, 42, -97.8, 0.5, ink)

    L.finish()
    for ob in list(co.objects):
        if ob.parent is None and ob is not root:
            parent_keep(ob, root)
    return root


# ======================================================== FUENTE FAC-662B
def build_fac662b():
    clear_collection('FAC662B')
    co = collection('FAC662B')
    reg, bold = font('arial.ttf'), font('arialbd.ttf')

    case = material('FAC_Caja', '#8B9096', 0.45, 0.6)
    panel = material('FAC_Panel', '#BEC5CC', 0.55)
    band = material('FAC_Franja', '#C9CFD4', 0.5)
    ink = material('FAC_Tinta', '#24282C', 0.6)
    redink = material('FAC_TintaRoja', '#C8261E', 0.6)
    disp = material('FAC_Display', '#2A0605', 0.25)
    bezel = material('FAC_BiselDisplay', '#3B3F44', 0.5)
    key = material('FAC_Tecla', '#9AA0A6', 0.5)
    keyb = material('FAC_TeclaMarco', '#D8DCDF', 0.5)
    knob = material('FAC_Mando', '#E4E4DE', 0.45)
    knob2 = material('FAC_MandoTapa', '#F1F1EC', 0.35)
    red = material('FAC_BorneRojo', '#C21A17', 0.3)
    blk = material('FAC_BorneNegro', '#1B1B1D', 0.3)
    grn = material('FAC_BorneVerde', '#167A4C', 0.35)
    ylw = material('FAC_BorneAmarillo', '#E2BD12', 0.35)
    hole = material('FAC_Hueco', '#060606', 0.9)
    metal = material('FAC_Metal', '#C8CACC', 0.25, 1.0)

    root = empty('FAC662B', co, 0, 0, 0)
    L = Labels('FAC', co, y0=-0.35)

    box('FAC_Caja', co, case, 312, 210, 262, 0, 106, 0, bevel=3)
    rrect('FAC_Panel', co, panel, 302, 252, 3, 3, 0, 0, y=0)
    rrect('FAC_Franja', co, band, 302, 18, 1, 0.4, 0, 112, y=-0.3)
    L.line(-151, 102.6, 151, 102.6, 0.6, ink)
    L.text('POWER  SUPPLY  FAC - 662B', 7, -128, 112, ink, align='LEFT', fnt=reg)
    L.frame(85, 107.5, 130, 116.5, 0.5, ink)
    L.poly([(88, 108.8), (95, 108.8), (91.5, 115.2)], redink, y=-0.45)
    L.text('PROMAX', 5, 113, 112, ink, fnt=reg)

    # Displays
    for k, x, u in (('V', -66, 'V'), ('A', 64, 'A')):
        rrect(f'FAC_Bisel_{k}', co, bezel, 60, 32, 2, 1, x, 77, y=-1)
        uv_plane(f'FAC_Disp_{k}', co, disp, 54, 26, x, 77, -1.1)
        L.text(u, 6, x + 39, 67, ink, fnt=bold)

    # Teclas
    def key_(name, x, z):
        k = rrect(name, co, key, 12, 12, 1.5, 6, x, z, y=-6, bevel=0.8)
        rrect(name + '_marco', co, keyb, 15, 15, 1.5, 3, x, z, y=-3)
        return k

    def s_n(x, z, n, size=4.6, mat=ink):
        """«S» con subíndice: Arial no trae los caracteres ₁ y ₂."""
        L.text('S', size, x - size * 0.12, z, mat, fnt=reg, align='RIGHT')
        L.text(n, size * 0.62, x - size * 0.08, z - size * 0.28, mat, fnt=reg, align='LEFT')

    key_('FAC_Btn_V_S1', -98, 19); key_('FAC_Btn_V_S2', -82, 19)
    L.text('V', 5, -90, 31.5, ink, fnt=reg)
    s_n(-97, 5.5, '1'); s_n(-81, 5.5, '2')
    for name, x in (('INDEP', -32), ('TRACK', -12), ('SERIES', 8), ('PARALL', 28)):
        key_(f'FAC_Btn_{name}', x, 19)
        L.text(name + ('.' if name == 'INDEP' else ''), 4.2, x, 6, ink, fnt=reg)
    L.text('FUNCTION', 4.8, -2, 31.5, ink, fnt=reg)
    key_('FAC_Btn_A_S1', 82, 19); key_('FAC_Btn_A_S2', 98, 19)
    L.text('A', 5, 90, 31.5, ink, fnt=reg)
    s_n(83, 5.5, '1'); s_n(99, 5.5, '2')

    # Marcos de los dos canales, con el hueco de los bornes de tierra y de la salida de 5 V
    L.polyline([(-131, -2), (-14, -2), (-14, -92), (-52, -92), (-52, -119), (-131, -119), (-131, -2)], 0.7, ink)
    L.polyline([(134, -2), (14, -2), (14, -92), (53, -92), (53, -119), (134, -119), (134, -2)], 0.7, ink)
    for x, t in ((-104, 'FINE'), (-43, 'COARSE'), (45, 'COARSE'), (103, 'FINE')):
        L.text(t, 5.2, x, -8, ink, fnt=reg)
    s_n(-72, -8, '1', 5.2); s_n(75, -8, '2', 5.2)
    L.text('VOLTAGE', 5.2, -72, -55, ink, fnt=reg)
    L.text('VOLTAGE', 5.2, 74, -55, ink, fnt=reg)
    L.text('I. LIMIT', 5, -98, -99, redink, fnt=reg)
    L.text('I. LIMIT', 5, 104, -99, ink, fnt=reg)
    L.text('30V-1A', 4.4, -117, -112, ink, fnt=reg)
    L.text('30V-1A', 4.4, 120, -112, ink, fnt=reg)

    # Mandos: giran alrededor de Y; el índice apunta hacia arriba con el mando a cero
    def knob_(name, x, z, r):
        e = empty(name, co, x, -2, z)
        skirt = cyl(name + '_falda', co, knob, r, 12, x, z, y=-14, seg=36, star=0.7, bevel=0.6)
        top = cyl(name + '_tapa', co, knob2, r * 0.82, 2, x, z, y=-16, seg=48, bevel=0.8)
        idx = rrect(name + '_indice', co, ink, 1.4, r * 0.55, 0.4, 0.3, x, z + r * 0.45, y=-16.15)
        for ob in (skirt, top, idx):
            parent_keep(ob, e)
        return e

    knob_('FAC_Knob_S1_Fine', -104, -31, 15)
    knob_('FAC_Knob_S1_Coarse', -43, -31, 15)
    knob_('FAC_Knob_S1_Ilim', -104, -79, 10.5)
    knob_('FAC_Knob_S2_Coarse', 45, -31, 15)
    knob_('FAC_Knob_S2_Fine', 103, -31, 15)
    knob_('FAC_Knob_S2_Ilim', 104, -79, 10.5)
    # Escalas alrededor de los mandos de ajuste
    for x, z, r in ((-104, -31, 15), (-43, -31, 15), (45, -31, 15), (103, -31, 15), (-104, -79, 10.5), (104, -79, 10.5)):
        for i in range(11):
            a = math.radians(-135 + 27 * i)
            L.line(x + (r + 2) * math.sin(a), z + (r + 2) * math.cos(a), x + (r + 4) * math.sin(a), z + (r + 4) * math.cos(a), 0.6, ink)

    # Interruptor LINE: palanca que gira alrededor de X
    cyl('FAC_Switch_base', co, metal, 6.5, 2, -1, -31, y=-2, seg=6)
    cyl('FAC_Switch_tuerca', co, metal, 4, 3, -1, -31, y=-5, seg=24)
    sw = empty('FAC_Switch_LINE', co, -1, -5, -31)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.6 * MM, radius2=1.2 * MM, depth=14 * MM)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 7 * MM))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
    lever = mesh_obj('FAC_Switch_palanca', bm, co, [metal], (-1, -5, -31))
    parent_keep(lever, sw)
    sw.rotation_euler = (math.radians(25), 0, 0)   # apagado: palanca hacia abajo (encendido: -25°)
    L.text('LINE', 5, -1, -11, ink, fnt=reg)
    L.text('I', 5, -1, -18, ink, fnt=reg)
    L.text('O', 5, -1, -45, ink, fnt=reg)

    # Bornes (números de la Figura 2.1)
    def post(name, mat, x, z, ring=None):
        cyl(name + '_base', co, ring or mat, 8, 3, x, z, y=-3, seg=6, bevel=0.5)
        p = cyl(name, co, mat, 6.2, 11, x, z, y=-14, seg=32, bevel=1)
        h = cyl(name + '_hueco', co, hole, 2.1, 1, x, z, y=-14.1, seg=20)
        parent_keep(h, p)
        return p

    post('FAC_Term_7', red, -54, -80)
    post('FAC_Term_8', blk, -27, -80)
    post('FAC_Term_9', grn, -40, -103, ylw)
    post('FAC_Term_10', red, -13, -101)
    post('FAC_Term_11', blk, 14, -101)
    post('FAC_Term_12', grn, 41, -103, ylw)
    post('FAC_Term_13', red, 27, -80)
    post('FAC_Term_14', blk, 54, -80)
    for x in (-54, 27):
        L.text('+', 8, x, -65, redink, fnt=reg)
    for x in (-27, 54):
        L.text('−', 8, x, -65, ink, fnt=reg)
    L.text('+', 8, -13, -88, redink, fnt=reg)
    L.text('−', 8, 14, -88, ink, fnt=reg)
    L.text('5V-2A', 4.4, 0.5, -116, ink, fnt=reg)
    for x in (-40, 41):
        L.line(x - 2.5, -114, x + 2.5, -114, 0.6, ink)
        L.line(x - 1.7, -115.4, x + 1.7, -115.4, 0.6, ink)
        L.line(x - 0.9, -116.8, x + 0.9, -116.8, 0.6, ink)
        L.line(x, -112, x, -114, 0.6, ink)

    L.finish()
    for ob in list(co.objects):
        if ob.parent is None and ob is not root:
            parent_keep(ob, root)
    root.location = (0.3, 0, 0)   # a la derecha del multímetro en la escena de Blender
    return root


# ------------------------------------------------------------- escena y exportación
def stage():
    clear_default()
    if not bpy.data.objects.get('Luz_Llave'):
        for name, loc, power in (('Luz_Llave', (-0.4, -0.6, 0.5), 60), ('Luz_Relleno', (0.6, -0.5, 0.2), 25)):
            ld = bpy.data.lights.new(name, 'AREA')
            ld.energy = power
            ld.size = 0.4
            lo = bpy.data.objects.new(name, ld)
            lo.location = loc
            lo.rotation_euler = (Vector((0.15, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.scene.collection.objects.link(lo)
    if not bpy.data.objects.get('Camara'):
        cd = bpy.data.cameras.new('Camara')
        cam = bpy.data.objects.new('Camara', cd)
        cam.location = (0.15, -0.75, 0.05)
        cam.rotation_euler = (math.radians(88), 0, 0)
        bpy.context.scene.collection.objects.link(cam)
        bpy.context.scene.camera = cam


def build_all():
    stage()
    build_pd695()
    build_fac662b()


def export(root_name, fname):
    os.makedirs(OUT, exist_ok=True)
    root = bpy.data.objects[root_name]
    saved = root.location.copy()
    root.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    stack = [root]
    while stack:
        o = stack.pop()
        o.select_set(True)
        stack.extend(o.children)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, fname), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
                              export_extras=False, export_draco_mesh_compression_enable=False)
    root.location = saved


def export_all():
    export('PD695', 'pd695.glb')
    export('FAC662B', 'fac662b.glb')
