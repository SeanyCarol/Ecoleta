import {Request, Response} from 'express';
import knex from '../database/connection';

class PointsController{
    //Filtrar pela cidade, uf, items(Query Params)
    async index(request: Request, response: Response) {
        const { city, uf, items } = request.query;

        //Trim serve para tirar os espaçamentos da direita depois da vírgula
        const parsedItems = String(items)
        .split(',')
        .map( item => Number(item.trim()));

        //Quando o param vem por Query tem que especificar o tipo da var, pois pode vir qualquer tipo
        //Distinct serve para retornar pontos de coletas distintos
        const points = await knex('points')
            .join('point_items', 'points.id', '=', 'point_items.point_id')
            .whereIn('point_items.item_id', parsedItems)
            .where('city', String(city))
            .where('uf', String(uf))
            .distinct()
            .select('points.*');

        //Transforma os dados pra um outro formato o qual vai ser mais acessícel para quem está requisitando as infos
        const serializedPoints = points.map( point => {
            return {
                ...point,
                image_url: `http://192.168.100.6:3333/uploads/${point.image}`,
            };
        });
            
        return response.json(serializedPoints);
    }

    async show(request: Request, response: Response) {
        const { id } = request.params;

        const point = await knex('points').where('id', id).first();

        if(!point){
            return response.status(400).json({message: 'Point not found.'});
        }

        const serializedPoint = {
            ...point,
            image_url: `http://192.168.100.6:3333/uploads/${point.image}`,
        };

        const items = await knex('items')
            .join('point_items', 'items.id', '=', 'point_items.item_id')
            .where('point_items.point_id', id)
            .select('items.title');
        
        return response.json({point: serializedPoint, items});
    }
    //Criação de pontos de coleta
    async create(request: Request, response: Response) {
        const {
            name,
            email,
            whatsapp,
            latitude,
            longitude,
            city,
            uf,
            items
        } = request.body;

        //Para testar se caso a segunda query falhar, a primeira não vai executar
        const trx = await knex.transaction();

        const point = {
            image: request.file.filename,
            name,
            email,
            whatsapp,
            latitude,
            longitude,
            city,
            uf
        };
          
        const insertedIds = await trx('points').insert(point);
    
        const point_id = insertedIds[0];
    
        const pointItems  = items
            .split(',')
            .map((item: string) => Number(item.trim()))
            .map((item_id: number) => {
                return {
                    item_id,
                    point_id,
                };
        });
    
        await trx('point_items').insert(pointItems);

        //Vai fazer os insert no banco, SEM ele não é feito os insert. Então sempre quando se usa TRANSACTION
        //no final de quando eu o uso
        await trx.commit();
    
        return response.json({ 
            id: point_id,
            ...point, 
        });
    }
}

export default PointsController;