import test from 'ava';
import { Document, Logger, PropertyType } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

const logger = new Logger(Logger.Verbosity.SILENT);

test('@gltf-transform/functions::prune', async (t) => {
	const doc = new Document().setLogger(logger);

	// Create used resources.
	const mesh = doc.createMesh();
	const node = doc.createNode().setMesh(mesh);
	const scene = doc.createScene().addChild(node);
	const chan = doc.createAnimationChannel().setTargetNode(node);
	const samp = doc.createAnimationSampler();
	const anim = doc.createAnimation().addChannel(chan).addSampler(samp);

	// Create unused resources.
	const mesh2 = doc.createMesh();
	const node2 = doc.createNode().setMesh(mesh2);
	const chan2 = doc.createAnimationChannel().setTargetNode(node2);
	const samp2 = doc.createAnimationSampler();
	const anim2 = doc.createAnimation().addChannel(chan2).addSampler(samp2);

	await doc.transform(prune());

	t.falsy(scene.isDisposed(), 'referenced scene');
	t.falsy(mesh.isDisposed(), 'referenced mesh');
	t.falsy(node.isDisposed(), 'referenced node');
	t.falsy(anim.isDisposed(), 'referenced animation');
	t.falsy(samp.isDisposed(), 'referenced sampler');
	t.falsy(chan.isDisposed(), 'referenced channel');

	t.truthy(mesh2.isDisposed(), 'unreferenced mesh');
	t.truthy(node2.isDisposed(), 'unreferenced node');
	t.truthy(anim2.isDisposed(), 'unreferenced animation');
	t.truthy(samp2.isDisposed(), 'unreferenced sampler');
	t.truthy(chan2.isDisposed(), 'unreferenced channel');
});

test('@gltf-transform/functions::prune | leaf nodes', async (t) => {
	const document = new Document().setLogger(logger);

	const mesh = document.createMesh();
	const skin = document.createSkin();
	const nodeC = document.createNode('C').setMesh(mesh);
	const nodeB = document.createNode('B').addChild(nodeC);
	const nodeA = document.createNode('A').addChild(nodeB).setSkin(skin);
	const scene = document.createScene().addChild(nodeA);

	await document.transform(prune({ keepLeaves: true }));

	t.falsy(scene.isDisposed(), 'scene in tree');
	t.falsy(nodeA.isDisposed(), 'nodeA in tree');
	t.falsy(nodeB.isDisposed(), 'nodeB in tree');
	t.falsy(nodeC.isDisposed(), 'nodeC in tree');
	t.falsy(mesh.isDisposed(), 'mesh in tree');
	t.falsy(skin.isDisposed(), 'skin in tree');

	mesh.dispose();
	await document.transform(prune());

	t.falsy(scene.isDisposed(), 'scene in tree');
	t.falsy(nodeA.isDisposed(), 'nodeA in tree');
	t.truthy(nodeB.isDisposed(), 'nodeB disposed');
	t.truthy(nodeC.isDisposed(), 'nodeC disposed');

	skin.dispose();
	await document.transform(prune({ keepLeaves: false, propertyTypes: [] }));

	t.falsy(scene.isDisposed(), 'scene in tree');
	t.falsy(nodeA.isDisposed(), 'nodeA disposed');

	await document.transform(prune({ keepLeaves: false, propertyTypes: [PropertyType.NODE] }));

	t.falsy(scene.isDisposed(), 'scene in tree');
	t.truthy(nodeA.isDisposed(), 'nodeA disposed');
});

test('@gltf-transform/functions::prune | attributes', async (t) => {
	const document = new Document().setLogger(logger);

	const position = document.createAccessor('POSITION');
	const tangent = document.createAccessor('TANGENT');
	const texcoord0 = document.createAccessor('TEXCOORD_0');
	const texcoord1 = document.createAccessor('TEXCOORD_1');
	const color0 = document.createAccessor('COLOR_0');
	const color1 = document.createAccessor('COLOR_1');
	const texture = document.createTexture();
	const material = document
		.createMaterial()
		.setRoughnessFactor(1)
		.setBaseColorTexture(texture)
		.setNormalTexture(texture);
	material.getBaseColorTextureInfo().setTexCoord(0);
	material.getNormalTextureInfo().setTexCoord(1);
	const prim = document
		.createPrimitive()
		.setMaterial(material)
		.setAttribute('POSITION', position)
		.setAttribute('TANGENT', tangent)
		.setAttribute('TEXCOORD_0', texcoord0)
		.setAttribute('TEXCOORD_1', texcoord1)
		.setAttribute('COLOR_0', color0)
		.setAttribute('COLOR_1', color1);
	document.createMesh().addPrimitive(prim);

	await document.transform(
		prune({
			propertyTypes: [PropertyType.ACCESSOR],
			keepAttributes: true,
		})
	);

	t.deepEqual(
		[position, tangent, texcoord0, texcoord1, color0, color1].map((a) => a.isDisposed()),
		new Array(6).fill(false),
		'keeps required attributes (1/3)'
	);

	await document.transform(
		prune({
			propertyTypes: [PropertyType.ACCESSOR],
			keepAttributes: false,
		})
	);

	t.deepEqual(
		[position, tangent, texcoord0, texcoord1, color0].map((a) => a.isDisposed()),
		new Array(5).fill(false),
		'keeps required attributes (2/3)'
	);
	t.is(color1.isDisposed(), true, 'discards COLOR_1');

	material.setNormalTexture(null);

	await document.transform(
		prune({
			propertyTypes: [PropertyType.ACCESSOR],
			keepAttributes: false,
		})
	);

	t.deepEqual(
		[position, texcoord0, color0].map((a) => a.isDisposed()),
		[false, false, false],
		'keeps required attributes (3/3)'
	);
	t.deepEqual(
		[tangent, texcoord1].map((a) => a.isDisposed()),
		[true, true],
		'discards TANGENT, TEXCOORD_1'
	);
});
