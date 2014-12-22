import * as LogManager from 'aurelia-logging';
import {Container} from 'aurelia-dependency-injection';
import {Loader} from 'aurelia-loader';
import {BindingLanguage,ResourceCoordinator, ViewSlot, ResourceRegistry} from 'aurelia-templating';
import {EventAggregator, includeEventsIn} from 'aurelia-event-aggregator';

var logger = LogManager.getLogger('aurelia');

function loadPlugins(loader, plugins){
  var toLoad = [], i, ii, current;

  for(i = 0, ii = plugins.length; i < ii; ++i){
    current = plugins[i];
    logger.debug(`Loading plugin ${current.moduleId}.`);
    toLoad.push(loader.loadModule(current.moduleId).then(exportedValue => {
      if('install' in exportedValue){
        return exportedValue.install(current.config || {}).then(() =>{
          logger.debug(`Installed plugin ${current.moduleId}.`);
        });
      }else{
        logger.debug(`Loaded plugin ${current.moduleId}.`);
      }
    }));
  }

  return Promise.all(toLoad);
}

export class Aurelia {
  constructor(loader, container, resources){
    this.loader = loader || Loader.createDefaultLoader();
    this.container = container || new Container();
    this.resources = resources || new ResourceRegistry();
    this.resourcesToLoad = [];
    this.plugins = [];

    this.withInstance(Aurelia, this);
    this.withInstance(Loader, this.loader);
    this.withInstance(ResourceRegistry, this.resources);
    this.withInstance(EventAggregator, includeEventsIn(this));
  }

  withInstance(type, instance){
    this.container.registerInstance(type, instance);
    return this;
  }

  withSingleton(type, implementation){
    this.container.registerSingleton(type, implementation);
    return this;
  }

  withBindingLanguage(languageType){
    this.container.registerSingleton(BindingLanguage, languageType);
    return this;
  }

  withPlugin(moduleId, config){
    this.plugins.push({moduleId:moduleId, config:config});
    return this;
  }

  withResources(resources){
    if(Array.isArray(resources)){
      this.resourcesToLoad = this.resourcesToLoad.concat(resources);
    }else{
      this.resourcesToLoad = this.resourcesToLoad.concat(Array.prototype.slice.call(arguments));
    }

    return this;
  }

  start(){
    if(this.started){
      return;
    }

    this.started = true;
    logger.info('Aurelia Starting');

    if(!this.container.hasHandler(BindingLanguage)){
      logger.error('You must configure Aurelia with a BindingLanguage implementation.');
    }

    return loadPlugins(this.loader, this.plugins).then(() => {
      return this.container.get(ResourceCoordinator)
        .importResources(this.resourcesToLoad).then(resources => {
          resources.forEach(x => x.register(this.resources));
          logger.info('Aurelia Started');
          return this;
        });
    });
  }

  setRoot(root, applicationHost){
    if (!applicationHost || typeof applicationHost == 'string') {
      this.host = document.getElementById(applicationHost || 'applicationHost') || document.body;
    } else {
      this.host = applicationHost;
    }

    this.host.aurelia = this;

    return this.container.get(ResourceCoordinator)
      .loadElement(root).then(type => {
        this.root = type.create(this.container);
        var slot = new ViewSlot(this.host, true);
        slot.swap(this.root.view);
        slot.attached();
        return this;
      });
  }
}