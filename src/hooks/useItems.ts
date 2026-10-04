import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query'; import {createItem,deleteItem,getItem,getItems,markFoundItemRecovered,updateItem} from '../services/items'; import type {Item} from '../types';
export const useItems=(kind?:Item['kind']|'lost-found')=>useQuery({queryKey:['items',kind],queryFn:()=>getItems(kind),refetchInterval:kind==='lend'?10000:false});
export const useItem=(id:string,kind:Item['kind'])=>useQuery({queryKey:['item',kind,id],queryFn:()=>getItem(id,kind)});
export const useCreateItem=()=>{const q=useQueryClient();return useMutation({mutationFn:createItem,onSuccess:()=>q.invalidateQueries({queryKey:['items']})})};
export const useMarkRecovered=()=>{const q=useQueryClient();return useMutation({mutationFn:markFoundItemRecovered,onSuccess:()=>{q.invalidateQueries({queryKey:['items']});q.invalidateQueries({queryKey:['item']})}})};
export const useUpdateItem=()=>{const q=useQueryClient();return useMutation({mutationFn:updateItem,onSuccess:()=>{q.invalidateQueries({queryKey:['items']});q.invalidateQueries({queryKey:['item']});q.invalidateQueries({queryKey:['my-lending']})}})};
export const useDeleteItem=()=>{const q=useQueryClient();return useMutation({mutationFn:deleteItem,onSuccess:()=>{q.invalidateQueries({queryKey:['items']});q.invalidateQueries({queryKey:['item']});q.invalidateQueries({queryKey:['my-lending']})}})};
