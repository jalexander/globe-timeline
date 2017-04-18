import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import THREE from 'three';
import 'imports?$=jquery!slick-carousel';

const ORIGINAL_WIDTH = 928;
const ORIGINAL_HEIGHT = 908;

const GlobeView = Backbone.View.extend({
  el: '.container',

  events: {
    mousedown: 'onMouseDown',
    mousemove: 'onMouseOver',
  },

  mouse: { x: 0, y: 0, z: 1 },
  mouseOnDown: { x: 0, y: 0 },
  rotation: { x: Math.PI * 3 / 2, y: Math.PI / 8 },
  target: { x: Math.PI * 3 / 2, y: Math.PI / 8 },
  targetOnDown: { x: 0, y: 0 },
  distance: 100000,
  distanceTarget: 100000,
  scene: new THREE.Scene(),
  ray: new THREE.Raycaster(),
  mouseVector: new THREE.Vector3(),
  intersects: [],
  $mapTooltip: $('.map-tooltip'),

  initialize() {
    _.bindAll(this,
      'addMarkers',
      'addMarker',
      'onMouseDown',
      'onMouseOver',
      'onMouseMove',
      'onMouseUp',
      'moveToPoint',
      'resize',
      'zoom',
      'animate',
      'render');

    this.bindToCollection();

    this.setupScene();
  },

  bindToCollection() {
    this.collection.bind('sync', this.addMarkers, this);

    this.collection.on('change:isActive', (model) => {
      if (model.get('isActive')) {
        this.moveToPoint(model.get('lat'), model.get('lon'));
        this.activeModelCid = model.cid;
      }
    });
  },

  setupScene() {
    this.setStageSize();

    this.camera = new THREE.PerspectiveCamera(25, this.w / this.h, 1, 10000);
    this.camera.position.z = this.distance;

    const globeMaterial = new THREE.MeshBasicMaterial();

    globeMaterial.map = new THREE.TextureLoader().load('./images/world.png');
    globeMaterial.fog = false;

    this.globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(200, 64, 64),
      globeMaterial
    );
    this.globeMesh.rotation.y = Math.PI;
    this.globeMesh.isGlobe = true;
    this.scene.add(this.globeMesh);
    this.pointsArray = [this.globeMesh];

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.w, this.h);

    this.renderer.domElement.style.position = 'absolute';

    this.$el.append(this.renderer.domElement);
  },

  setStageSize() {
    const ratio = Math.min(
      (window.innerWidth - 50) / ORIGINAL_WIDTH,
      (window.innerHeight + 150) / ORIGINAL_HEIGHT
    );

    this.w = Math.ceil(ORIGINAL_WIDTH * ratio);
    this.h = Math.ceil(ORIGINAL_HEIGHT * ratio);

    this.$el.css({
      height: this.h,
      width: this.w,
      marginTop: `-${(this.h / 2)}px`,
      marginLeft: `-${(this.w / 2)}px`,
      opacity: 1,
    });
  },

  addMarkers() {
    const firstModel = this.collection.first();

    this.rotation.x = this.target.x = - Math.PI / 2 + (firstModel.get('lon') * Math.PI / 180);
    this.rotation.y = this.target.y = firstModel.get('lat') * Math.PI / 180;
    this.animate();
    this.collection.each(model => {
      this.addMarker(model);
    });

    const activeModel = this.collection.first();
    this.activeModelCid = activeModel.cid;
  },

  addMarker(model) {
    const phi = (90 - model.get('lat')) * Math.PI / 180;
    const theta = (180 - model.get('lon')) * Math.PI / 180;
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x607D8B,
      transparent: true,
      opacity: 0.5,
    });
    const marker = new THREE.Mesh(geometry, material);

    marker.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    marker.position.y = 200 * Math.cos(phi);
    marker.position.z = 200 * Math.sin(phi) * Math.sin(theta);
    marker.modelId = model.cid;

    this.scene.add(marker);
    this.pointsArray.push(marker);
  },

  onMouseDown(event) {
    event.preventDefault();

    this.$el
      .on('mousemove', this.onMouseMove)
      .on('mouseup', this.onMouseUp);

    this.mouseOnDown.x = - event.clientX;
    this.mouseOnDown.y = event.clientY;

    this.targetOnDown.x = this.target.x;
    this.targetOnDown.y = this.target.y;

    if (this.intersects[0] && this.intersects[0].object.isGlobe) {
      this.$el.css('cursor', 'move');
    }
  },

  onMouseOver(event) {
    const x = event.pageX - this.$el.offset().left;
    const y = event.pageY - this.$el.offset().top;

    this.mouse.x = (x / this.w) * 2 - 1;
    this.mouse.y = - (y / this.h) * 2 + 1;
    this.mouseVector.set(this.mouse.x, this.mouse.y, this.mouse.z);

    this.ray.setFromCamera(this.mouseVector, this.camera);
    this.intersects = this.ray.intersectObjects(this.pointsArray);

    if (this.intersects[0] &&
      !this.intersects[0].object.isGlobe &&
      this.activeModelCid !== this.intersects[0].object.modelId) {
      this.$el.css('cursor', 'pointer');
      const currentMarkerModel = this.collection.get(this.intersects[0].object.modelId);
      this.$mapTooltip.find('.map-tooltip__date')
        .text(`${currentMarkerModel.get('year')}-${currentMarkerModel.get('location')}`);

      this.$mapTooltip.find('.map-tooltip__title').text(currentMarkerModel.get('title'));

      this.$mapTooltip.css({
        left: event.pageX,
        top: event.pageY,
      }).addClass('is-active');
    } else {
      this.$el.css({ cursor: 'default' });
      this.$mapTooltip.removeClass('is-active');
    }
  },

  onMouseMove(event) {
    if (this.intersects[0] && this.intersects[0].object.isGlobe) {
      this.mouse.x = - event.clientX;
      this.mouse.y = event.clientY;

      const zoomDamp = this.distance / 1000;

      this.target.x = this.targetOnDown.x + (this.mouse.x - this.mouseOnDown.x) * 0.005 * zoomDamp;
      this.target.y = this.targetOnDown.y + (this.mouse.y - this.mouseOnDown.y) * 0.005 * zoomDamp;

      this.$el.css({ cursor: 'move' });
    }
  },

  onMouseUp() {
    this.$el
      .off('mousemove', this.onMouseMove)
      .off('mouseup', this.onMouseUp)
      .css('cursor', 'auto');

    if (this.intersects[0] && !this.intersects[0].object.isGlobe) {
      if (this.activeModelCid) {
        this.collection.get(this.activeModelCid).set({
          isActive: false,
        });
      }
      const activeModel = this.collection.get(this.intersects[0].object.modelId);
      activeModel.set({
        isActive: true,
      });
    }
  },

  moveToPoint(lat, lng) {
    this.target.x = - Math.PI / 2 + (lng * Math.PI / 180);
    this.target.y = lat * Math.PI / 180;
  },

  resize() {
    this.setStageSize();
    this.renderer.setSize(this.w, this.h);
  },

  zoom(delta) {
    this.distanceTarget -= delta;
    this.distanceTarget = this.distanceTarget > 1000 ? 1000 : this.distanceTarget;
    this.distanceTarget = this.distanceTarget < 350 ? 350 : this.distanceTarget;
  },

  animate() {
    requestAnimationFrame(() => this.animate());
    this.render();
  },

  render() {
    this.zoom(0);

    this.rotation.x += (this.target.x - this.rotation.x) * 0.05;
    this.rotation.y += (this.target.y - this.rotation.y) * 0.05;
    this.distance += (this.distanceTarget - this.distance) * 0.3;

    this.camera.position.x = this.distance * Math.sin(this.rotation.x) * Math.cos(this.rotation.y);
    this.camera.position.y = this.distance * Math.sin(this.rotation.y);
    this.camera.position.z = this.distance * Math.cos(this.rotation.x) * Math.cos(this.rotation.y);

    this.camera.lookAt(this.globeMesh.position);

    this.renderer.render(this.scene, this.camera);
  },
});

export default GlobeView;
