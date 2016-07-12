import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import THREE from 'three';
import 'imports?$=jquery!slick-carousel';

const GlobeView = Backbone.View.extend({
  el: '.container',

  initialize() {
    _.bindAll(this,
      'addMarkers',
      'addMarker',
      'onMouseDown',
      'onMouseOver',
      'onMouseMove',
      'onMouseUp',
      'onMouseOut',
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
    this.mouse = { x: 0, y: 0 };
    this.mouseOnDown = { x: 0, y: 0 };
    this.rotation = { x: Math.PI * 3 / 2, y: Math.PI / 8 };
    this.target = { x: Math.PI * 3 / 2, y: Math.PI / 8 };
    this.targetOnDown = { x: 0, y: 0 };
    this.distance = 100000;
    this.distanceTarget = 100000;
    this.padding = 40;
    this.PI_HALF = Math.PI / 2;

    this.aspectRatio = 928 / 908;

    if (window.innerWidth < 1514) {
      this.w = window.innerWidth - 50;
      this.h = this.w + this.aspectRatio;
    } else {
      this.h = window.innerHeight + 180;
      this.w = this.h * this.aspectRatio;
    }

    this.$el.css({
      height: this.h,
      width: this.w,
      marginTop: `-${(this.h / 2)}px`,
      marginLeft: `-${(this.w / 2)}px`,
    });

    this.camera = new THREE.PerspectiveCamera(25, this.w / this.h, 1, 10000);
    this.camera.position.z = this.distance;

    this.scene = new THREE.Scene();

    const globeGeometry = new THREE.SphereGeometry(200, 64, 64);

    const globeMaterial = new THREE.MeshBasicMaterial();
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('./images/world.png');

    globeMaterial.map = textureLoader.load('./images/world.png');
    globeMaterial.fog = false;

    this.globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    this.globeMesh.rotation.y = Math.PI;
    this.globeMesh.isGlobe = true;
    this.scene.add(this.globeMesh);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.w, this.h);

    this.renderer.domElement.style.position = 'absolute';

    this.$el.append(this.renderer.domElement);

    this.$el.on('mousedown', this.onMouseDown);
    this.$el.on('mousemove', this.onMouseOver);

    this.pointsArray = [this.globeMesh];

    this.mouse2 = { x: 0, y: 0, z: 1 };
    this.ray = new THREE.Raycaster();
    this.mouseVector = new THREE.Vector3();
    this.intersects = [];
    this.clickInfo = {};
  },

  addMarkers() {
    const firstModel = this.collection.first();

    this.rotation.x = - Math.PI / 2 + (firstModel.get('lon') * Math.PI / 180);
    this.rotation.y = firstModel.get('lat') * Math.PI / 180;
    this.target.x = - Math.PI / 2 + (firstModel.get('lon') * Math.PI / 180);
    this.target.y = firstModel.get('lat') * Math.PI / 180;
    this.animate();
    this.collection.each(journeyModel => {
      this.addMarker(journeyModel);
    });

    const activeModel = this.collection.first();
    this.activeModelCid = activeModel.cid;
  },

  addMarker(journeyModel) {
    const phi = (90 - journeyModel.get('lat')) * Math.PI / 180;
    const theta = (180 - journeyModel.get('lon')) * Math.PI / 180;
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
    marker.modelId = journeyModel.cid;

    this.scene.add(marker);
    this.pointsArray.push(marker);
  },

  onMouseDown(event) {
    event.preventDefault();

    this.$el.on('mousemove', this.onMouseMove);
    this.$el.on('mouseup', this.onMouseUp);
    this.$el.on('mouseout', this.onMouseOut);

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
    const $mapTooltip = $('.map-tooltip');

    this.mouse2.x = (x / this.w) * 2 - 1;
    this.mouse2.y = - (y / this.h) * 2 + 1;
    this.mouseVector.set(this.mouse2.x, this.mouse2.y, this.mouse2.z);

    this.ray.setFromCamera(this.mouseVector, this.camera);
    this.intersects = this.ray.intersectObjects(this.pointsArray);

    if (this.intersects[0] &&
      !this.intersects[0].object.isGlobe &&
      this.activeModelCid !== this.intersects[0].object.modelId) {
      this.$el.css('cursor', 'pointer');
      const currentMarkerModel = this.collection.get(this.intersects[0].object.modelId);
      $mapTooltip.find('.map-tooltip__date')
        .text(`${currentMarkerModel.get('year')}-${currentMarkerModel.get('location')}`);

      $mapTooltip.find('.map-tooltip__title').text(currentMarkerModel.get('title'));

      $mapTooltip.css({
        left: event.pageX,
        top: event.pageY,
      }).addClass('is-active');
    } else {
      this.$el.css({ cursor: 'default' });
      $mapTooltip.removeClass('is-active');
    }
  },

  onMouseMove(event) {
    this.mouse.x = - event.clientX;
    this.mouse.y = event.clientY;

    const zoomDamp = this.distance / 1000;

    this.target.x = this.targetOnDown.x + (this.mouse.x - this.mouseOnDown.x) * 0.005 * zoomDamp;
    this.target.y = this.targetOnDown.y + (this.mouse.y - this.mouseOnDown.y) * 0.005 * zoomDamp;

    this.target.y = this.target.y > this.PI_HALF ? this.PI_HALF : this.target.y;
    this.target.y = this.target.y < - this.PI_HALF ? - this.PI_HALF : this.target.y;

    $('.year .active').css({ opacity: 0 });
    $('.year .timeline-display .date').css({ opacity: 1 });
    $('.year .timeline-display').css({ color: '#464646' });

    this.$el.css({ cursor: 'move' });
  },

  onMouseUp(event) {
    this.$el.off('mousemove', this.onMouseMove);
    this.$el.off('mouseup', this.onMouseUp);
    this.$el.off('mouseout', this.onMouseOut);
    this.$el.css('cursor', 'auto');

    const x = event.pageX - this.$el.offset().left;
    const y = event.pageY - this.$el.offset().top;

    this.mouse2.x = (x / this.w) * 2 - 1;
    this.mouse2.y = - (y / this.h) * 2 + 1;
    this.mouseVector.set(this.mouse2.x, this.mouse2.y, this.mouse2.z);

    this.ray.setFromCamera(this.mouseVector, this.camera);
    this.intersects = this.ray.intersectObjects(this.pointsArray);
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

  onMouseOut() {
    this.$el.off('mousemove', this.onMouseMove);
    this.$el.off('mouseup', this.onMouseUp);
    this.$el.off('mouseout', this.onMouseOut);
  },

  moveToPoint(lat, lng) {
    const phi = lat * Math.PI / 180;
    const theta = lng * Math.PI / 180;

    this.target.x = - Math.PI / 2 + theta;
    this.target.y = phi;
  },

  resize() {
    if (window.innerWidth < 1514) {
      this.w = window.innerWidth - 50;
      this.h = this.w + this.aspectRatio;
    } else {
      this.h = window.innerHeight + 180;
      this.w = this.h * this.aspectRatio;
    }

    this.$el.css({
      height: this.h,
      width: this.w,
      marginTop: `-${(this.h / 2)}px`,
      marginLeft: `-${(this.w / 2)}px`,
    });

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
