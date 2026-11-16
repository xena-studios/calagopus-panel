use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod fleet;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/fleet", fleet::router(state))
        .with_state(state.clone())
}
